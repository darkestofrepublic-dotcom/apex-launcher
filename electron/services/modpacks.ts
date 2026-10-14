import fs from "node:fs";
import path from "node:path";
import type { LoaderType, OperationResult } from "../../shared/types.js";
import { getLogger } from "./store.js";
import { isSafeArchivePath, sanitizeFileName } from "./content.js";
import { enqueueDownload } from "./downloads.js";
import { createInstance, getInstance } from "./instances.js";

interface MrPackIndex {
  formatVersion: number;
  game: string;
  versionId: string;
  name: string;
  dependencies?: Record<string, string>;
  files?: { path: string; hashes: { sha1: string }; downloads: string[]; fileSize: number }[];
}

/** Importe un fichier .mrpack dans une instance dédiée (jamais de fusion globale). */
export async function importMrPack(mrpackPath: string): Promise<OperationResult<string>> {
  const log = getLogger();
  try {
    const { default: unzipper } = await import("unzipper");
    const dir = await unzipper.Open.file(mrpackPath);
    const indexEntry = dir.files.find((f: { path: string }) => f.path === "modrinth.index.json");
    if (!indexEntry) return { ok: false, error: "Fichier .mrpack invalide : modrinth.index.json manquant." };
    const index = JSON.parse((await indexEntry.buffer()).toString("utf-8")) as MrPackIndex;

    const created = createInstance({
      name: index.name || "Modpack importé",
      description: `Importé depuis ${path.basename(mrpackPath)}`,
      minecraftVersion: index.game,
      loader: "vanilla",
    });
    if (!created.ok || !created.data) return { ok: false, error: created.error ?? "Création d'instance impossible." };
    const instance = created.data;

    // Fichiers embarqués (overrides) avec contrôle anti zip-slip
    for (const file of dir.files) {
      const p: string = file.path;
      if (p === "modrinth.index.json") continue;
      if (p.startsWith("overrides/")) {
        const rel = p.slice("overrides/".length);
        if (!isSafeArchivePath(instance.directory, rel)) {
          log.warn("modpacks", `Chemin d'archive refusé (sécurité) : ${rel}`);
          continue;
        }
        const dest = path.join(instance.directory, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const content = await file.buffer();
        fs.writeFileSync(dest, content);
      }
    }

    // Fichiers distants (mods, etc.)
    for (const f of index.files ?? []) {
      if (!isSafeArchivePath(instance.directory, f.path)) {
        log.warn("modpacks", `Chemin distant refusé (sécurité) : ${f.path}`);
        continue;
      }
      const dest = path.join(instance.directory, f.path);
      if (!fs.existsSync(dest) && f.downloads[0]) {
        await enqueueDownload({ label: sanitizeFileName(path.basename(f.path)), url: f.downloads[0], destination: dest, expectedSize: f.fileSize, sha1: f.hashes.sha1 });
      }
    }
    log.info("modpacks", `Modpack importé dans l'instance « ${instance.name} »`);
    return { ok: true, data: instance.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Import du modpack impossible." };
  }
}

/** Importe un modpack CurseForge (.zip avec manifest.json) dans une instance dédiée. */
export async function importCurseforgeZip(zipPath: string): Promise<OperationResult<string>> {
  const log = getLogger();
  try {
    const { default: unzipper } = await import("unzipper");
    const { getCurseforgeDownloadUrl } = await import("./content.js");
    const dir = await unzipper.Open.file(zipPath);
    const manifestEntry = dir.files.find((f: { path: string }) => f.path === "manifest.json");
    if (!manifestEntry) return { ok: false, error: "Archive invalide : manifest.json manquant (modpack CurseForge attendu)." };
    const manifest = JSON.parse((await manifestEntry.buffer()).toString("utf-8")) as {
      name: string;
      minecraft: { version: string; modLoaders: { id: string; primary: boolean }[] };
      files: { projectID: number; fileID: number; required: boolean }[];
      overrides?: string;
    };
    const mcVersion = manifest.minecraft?.version;
    if (!mcVersion) return { ok: false, error: "Version de Minecraft absente du manifest." };
    const primaryLoader = manifest.minecraft.modLoaders?.find((l) => l.primary) ?? manifest.minecraft.modLoaders?.[0];
    let loader: LoaderType = "vanilla";
    let loaderVersion: string | undefined;
    if (primaryLoader?.id) {
      const [name, ...rest] = primaryLoader.id.split("-");
      const ver = rest.join("-");
      const n = name.toLowerCase();
      if (n.includes("neoforge")) loader = "neoforge";
      else if (n.includes("forge")) loader = "forge";
      else if (n.includes("fabric")) loader = "fabric";
      else if (n.includes("quilt")) loader = "quilt";
      if (loader !== "vanilla") loaderVersion = loader === "forge" ? `${mcVersion}-${ver}` : ver;
    }
    const created = createInstance({
      name: (manifest.name || "Modpack CurseForge").slice(0, 80),
      description: `Modpack CurseForge « ${manifest.name || ""} »`,
      minecraftVersion: mcVersion,
      loader,
      loaderVersion,
    });
    if (!created.ok || !created.data) return { ok: false, error: created.error ?? "Création d'instance impossible." };
    const instance = created.data;
    const overridesPrefix = (manifest.overrides ?? "overrides") + "/";

    for (const file of dir.files) {
      const p: string = file.path;
      if (p === "manifest.json" || p === "modlist.html") continue;
      if (p.startsWith(overridesPrefix)) {
        const rel = p.slice(overridesPrefix.length);
        if (!isSafeArchivePath(instance.directory, rel)) {
          log.warn("modpacks", `Chemin d'archive refusé (sécurité) : ${rel}`);
          continue;
        }
        const dest = path.join(instance.directory, rel);
        if (p.endsWith("/")) {
          fs.mkdirSync(dest, { recursive: true });
        } else {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, await file.buffer());
        }
      }
    }

    let queued = 0;
    for (const f of manifest.files?.filter((x) => x.required) ?? []) {
      try {
        const url = await getCurseforgeDownloadUrl(f.projectID, f.fileID);
        const dest = path.join(instance.directory, "mods", `cf-${f.projectID}-${f.fileID}.jar`);
        await enqueueDownload({ label: `CurseForge ${f.projectID}/${f.fileID}`, url, destination: dest });
        queued += 1;
      } catch (err) {
        log.warn("modpacks", `Fichier ${f.projectID}/${f.fileID} ignoré : ${(err as Error).message}`);
      }
    }
    log.info("modpacks", `Modpack CurseForge importé : ${queued} fichier(s) requis en file.`);
    return { ok: true, data: instance.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Import CurseForge impossible." };
  }
}

/** Installe un modpack Modrinth : télécharge le .mrpack puis l'importe dans une instance dédiée. */
export async function installModrinthPack(projectId: string): Promise<OperationResult<string>> {
  const log = getLogger();
  try {
    const { getProjectVersions } = await import("./content.js");
    const { enqueueDownload, } = await import("./downloads.js");
    const { downloadsDir } = await import("./downloads.js");
    const versions = (await getProjectVersions(projectId)) as {
      id: string; version_number: string;
      files: { url: string; filename: string; primary: boolean; size: number; hashes: { sha1: string } }[];
    }[];
    if (!versions.length) return { ok: false, error: "Aucune version disponible pour ce modpack." };
    const chosen = versions[0];
    const file = chosen.files.find((f) => f.primary && f.filename.endsWith(".mrpack")) ?? chosen.files.find((f) => f.filename.endsWith(".mrpack"));
    if (!file) return { ok: false, error: "Ce projet ne fournit pas de fichier .mrpack installable." };
    const dest = path.join(downloadsDir(), sanitizeFileName(file.filename));
    await enqueueDownload({ label: file.filename, url: file.url, destination: dest, expectedSize: file.size, sha1: file.hashes.sha1 });
    const { waitForDownloadsDrained } = await import("./versions.js");
    const drained = await waitForDownloadsDrained(20 * 60 * 1000);
    if (!drained) return { ok: false, error: "Téléchargement trop long ou interrompu." };
    log.info("modpacks", `Modpack Modrinth téléchargé : ${file.filename} — import…`);
    return importMrPack(dest);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Installation impossible." };
  }
}

/** Exporte une instance vers un .mrpack minimal (overrides + liste). */
export async function exportMrPack(instanceId: string, destination: string): Promise<OperationResult> {
  try {
    const { default: archiver } = await import("archiver");
    const instance = getInstance(instanceId);
    if (!instance) return { ok: false, error: "Instance introuvable." };
    const output = fs.createWriteStream(destination);
    const archive = archiver("zip", { zlib: { level: 9 } });
    await new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      archive.on("error", reject);
      archive.pipe(output);
      archive.append(
        JSON.stringify({ formatVersion: 1, game: "minecraft", versionId: "1.0.0", name: instance.name, dependencies: { minecraft: instance.minecraftVersion } }, null, 2),
        { name: "modrinth.index.json" },
      );
      for (const folder of ["config", "datapacks"]) {
        const full = path.join(instance.directory, folder);
        if (fs.existsSync(full)) archive.directory(full, `overrides/${folder}`);
      }
      void archive.finalize();
    });
    getLogger().info("modpacks", `Instance exportée : ${destination}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Export impossible." };
  }
}
