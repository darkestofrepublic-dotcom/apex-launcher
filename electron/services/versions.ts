import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import type { McVersionInfo, OperationResult } from "../../shared/types.js";
import { APP_CONFIG } from "../../shared/config.js";
import { getDataDir, getLogger } from "./store.js";
import { enqueueDownload } from "./downloads.js";

interface ManifestEntry {
  id: string;
  type: string;
  url: string;
  time: string;
  releaseTime: string;
}

interface LibraryArtifact {
  path: string;
  sha1: string;
  size: number;
  url: string;
}

interface Library {
  name: string;
  downloads?: { artifact?: LibraryArtifact; classifiers?: Record<string, LibraryArtifact> };
  rules?: { action: "allow" | "disallow"; os?: { name?: string } }[];
  natives?: Record<string, string>;
}

interface VersionJson {
  id: string;
  mainClass: string;
  minecraftArguments?: string;
  arguments?: { game?: unknown[]; jvm?: unknown[] };
  assetIndex?: { id: string; sha1: string; size: number; url: string };
  assets?: string;
  downloads?: { client: { sha1: string; size: number; url: string } };
  libraries: Library[];
  javaVersion?: { component: string; majorVersion: number };
}

let manifestCache: { latest?: { release: string; snapshot: string }; versions: ManifestEntry[] } | null = null;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "ApexLauncher/1.0" } });
  if (!res.ok) throw new Error(`Échec réseau (HTTP ${res.status}). Vérifiez votre connexion puis réessayez.`);
  return (await res.json()) as T;
}

function versionsPath(versionId: string): string {
  return path.join(getDataDir(), "versions", versionId, `${versionId}.json`);
}

export function isVersionInstalled(versionId: string): boolean {
  return fs.existsSync(versionsPath(versionId)) && fs.existsSync(clientJarPath(versionId));
}

export function clientJarPath(versionId: string): string {
  return path.join(getDataDir(), "versions", versionId, `${versionId}.jar`);
}

export async function listVersions(): Promise<McVersionInfo[]> {
  const log = getLogger();
  try {
    if (!manifestCache) {
      const fresh = await fetchJson<{ latest?: { release: string; snapshot: string }; versions: ManifestEntry[] }>(
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
      );
      manifestCache = fresh;
    }
    const cache: { latest?: { release: string; snapshot: string }; versions: ManifestEntry[] } = manifestCache;
    return cache.versions.map((v) => ({
      id: v.id,
      type: (["release", "snapshot", "old_beta", "old_alpha"].includes(v.type) ? v.type : "snapshot") as McVersionInfo["type"],
      url: v.url,
      releaseTime: v.releaseTime,
      installed: isVersionInstalled(v.id),
      complete: isVersionInstalled(v.id),
    }));
  } catch (err) {
    log.error("versions", `Impossible de récupérer la liste des versions : ${(err as Error).message}`);
    throw err;
  }
}

export function latestRelease(): string | undefined {
  return manifestCache?.latest?.release;
}

export async function getVersionJson(versionId: string): Promise<VersionJson> {
  const local = versionsPath(versionId);
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, "utf-8")) as VersionJson;
  const manifest = await fetchJson<{ versions: ManifestEntry[] }>(APP_CONFIG.mojangVersionManifest);
  const entry = manifest.versions.find((v) => v.id === versionId);
  if (!entry) throw new Error(`Version inconnue : ${versionId}`);
  const json = await fetchJson<VersionJson>(entry.url);
  fs.mkdirSync(path.dirname(local), { recursive: true });
  fs.writeFileSync(local, JSON.stringify(json, null, 2));
  return json;
}

function libraryAllowed(lib: Library): boolean {
  if (!lib.rules) return true;
  let allowed = false;
  const platform = os.platform() === "win32" ? "windows" : os.platform() === "darwin" ? "osx" : "linux";
  for (const rule of lib.rules) {
    const matches = !rule.os?.name || rule.os.name === platform;
    if (matches) allowed = rule.action === "allow";
  }
  return allowed;
}

function mavenToPath(name: string): string {
  const [group, artifact, version] = name.split(":");
  return `${group.replace(/\./g, "/")}/${artifact}/${version}/${artifact}-${version}.jar`;
}

export async function installVersion(versionId: string): Promise<OperationResult> {
  const log = getLogger();
  try {
    log.info("versions", `Installation de Minecraft ${versionId}…`);
    const vjson = await getVersionJson(versionId);

    // 1. Client
    if (vjson.downloads?.client) {
      const dest = clientJarPath(versionId);
      if (!fs.existsSync(dest)) {
        await enqueueDownload({
          label: `Minecraft ${versionId} (client)`,
          url: vjson.downloads.client.url,
          destination: dest,
          expectedSize: vjson.downloads.client.size,
          sha1: vjson.downloads.client.sha1,
        });
      }
    }

    // 2. Bibliothèques (+ natives Windows)
    const isWindows = os.platform() === "win32";
    for (const lib of vjson.libraries.filter(libraryAllowed)) {
      const art = lib.downloads?.artifact;
      if (art) {
        const dest = path.join(getDataDir(), "libraries", art.path);
        if (!fs.existsSync(dest)) {
          await enqueueDownload({ label: `Bibliothèque ${lib.name}`, url: art.url, destination: dest, expectedSize: art.size, sha1: art.sha1 });
        }
      }
      if (isWindows && lib.natives?.["windows"] && lib.downloads?.classifiers) {
        const classifierKey = lib.natives["windows"].replace("${arch}", os.arch() === "x64" ? "64" : "32");
        const native = lib.downloads.classifiers[classifierKey] ?? lib.downloads.classifiers["natives-windows"];
        if (native) {
          const dest = path.join(getDataDir(), "libraries", native.path);
          if (!fs.existsSync(dest)) {
            await enqueueDownload({ label: `Natif ${lib.name}`, url: native.url, destination: dest, expectedSize: native.size, sha1: native.sha1 });
          }
        }
      }
    }

    // 3. Index des ressources + client des assets essentiels (léger : index uniquement ici,
    // le jeu complète au lancement ; on télécharge l'index pour valider l'installation)
    if (vjson.assetIndex) {
      const dest = path.join(getDataDir(), "assets", "indexes", `${vjson.assetIndex.id}.json`);
      if (!fs.existsSync(dest)) {
        await enqueueDownload({
          label: `Index des ressources ${vjson.assetIndex.id}`,
          url: vjson.assetIndex.url,
          destination: dest,
          expectedSize: vjson.assetIndex.size,
          sha1: vjson.assetIndex.sha1,
        });
      }
    }

    log.info("versions", `Minecraft ${versionId} prêt.`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec de l'installation.";
    log.error("versions", `Échec installation ${versionId} : ${message}`);
    return { ok: false, error: message };
  }
}

export async function removeVersion(versionId: string): Promise<OperationResult> {
  try {
    fs.rmSync(path.join(getDataDir(), "versions", versionId), { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Suppression impossible." };
  }
}

/** Télécharge les objets d'assets manquants à partir de l'index (avec vérification SHA-1). */
export async function ensureAssets(versionId: string): Promise<void> {
  const vjson = await getVersionJson(versionId);
  const indexId = vjson.assetIndex?.id ?? vjson.assets;
  if (!indexId) return;
  const indexFile = path.join(getDataDir(), "assets", "indexes", `${indexId}.json`);
  if (!fs.existsSync(indexFile)) return;
  const index = JSON.parse(fs.readFileSync(indexFile, "utf-8")) as { objects: Record<string, { hash: string; size: number }> };
  let queued = 0;
  for (const [name, obj] of Object.entries(index.objects)) {
    const dest = path.join(getDataDir(), "assets", "objects", obj.hash.slice(0, 2), obj.hash);
    if (!fs.existsSync(dest) && queued < 400) {
      queued += 1;
      await enqueueDownload({
        label: `Ressource ${name}`,
        url: `https://resources.download.minecraft.net/${obj.hash.slice(0, 2)}/${obj.hash}`,
        destination: dest,
        expectedSize: obj.size,
        sha1: obj.hash,
      });
    }
  }
}

export function buildClasspath(versionId: string, vjson: VersionJson): string {
  const libs: string[] = [];
  for (const lib of vjson.libraries.filter(libraryAllowed)) {
    const art = lib.downloads?.artifact;
    if (art) libs.push(path.join(getDataDir(), "libraries", art.path));
    else if (lib.name) {
      const candidate = path.join(getDataDir(), "libraries", mavenToPath(lib.name));
      if (fs.existsSync(candidate)) libs.push(candidate);
    }
  }
  libs.push(clientJarPath(versionId));
  return libs.join(path.delimiter);
}

/** Extrait les bibliothèques natives Windows (LWJGL, etc.) vers le dossier natives. */
export async function extractNatives(versionId: string, vjson: VersionJson, nativesDir: string): Promise<void> {
  if (os.platform() !== "win32") return;
  const { default: unzipper } = await import("unzipper");
  for (const lib of vjson.libraries.filter(libraryAllowed)) {
    if (!lib.natives?.["windows"] || !lib.downloads?.classifiers) continue;
    const key = lib.natives["windows"].replace("${arch}", os.arch() === "x64" ? "64" : "32");
    const native = lib.downloads.classifiers[key] ?? lib.downloads.classifiers["natives-windows"];
    if (!native) continue;
    const jarPath = path.join(getDataDir(), "libraries", native.path);
    if (!fs.existsSync(jarPath)) continue;
    const marker = path.join(nativesDir, `.extrait-${createHash("sha1").update(native.path).digest("hex").slice(0, 12)}`);
    if (fs.existsSync(marker)) continue;
    const dir = await unzipper.Open.file(jarPath);
    for (const file of dir.files as { type: string; path: string; buffer: () => Promise<Buffer> }[]) {
      if (file.type === "Directory") continue;
      if (file.path.includes("..") || path.isAbsolute(file.path) || file.path.startsWith("META-INF/")) continue;
      const dest = path.resolve(nativesDir, path.basename(file.path));
      if (!dest.startsWith(path.resolve(nativesDir) + path.sep)) continue;
      fs.writeFileSync(dest, await file.buffer());
    }
    fs.writeFileSync(marker, "ok");
  }
  void versionId;
}

export function waitForDownloadsDrained(timeoutMs = 30 * 60 * 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const start = Date.now();
    const timer = setInterval(async () => {
      const { listDownloads } = await import("./downloads.js");
      const pending = listDownloads().some((d) => ["attente", "cours", "verification", "installation", "suspendu"].includes(d.status));
      if (!pending) {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 500);
  });
}

export { spawn };
