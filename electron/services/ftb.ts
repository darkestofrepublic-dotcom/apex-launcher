import fs from "node:fs";
import path from "node:path";
import type { LoaderType, OperationResult } from "../../shared/types.js";
import { getLogger } from "./store.js";
import { isSafeArchivePath, sanitizeFileName } from "./content.js";
import { enqueueDownload } from "./downloads.js";
import { createInstance } from "./instances.js";

const FTB_API = "https://api.modpacks.ch/public";

async function ftbJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "ApexLauncher/1.0" } });
  if (!res.ok) throw new Error(`FTB indisponible (HTTP ${res.status}). Réessayez plus tard.`);
  return (await res.json()) as T;
}

export interface FtbPackSummary {
  id: number;
  name: string;
  synopsis: string;
  authors: { name: string }[];
  installs: number;
  iconUrl?: string;
  splashUrl?: string;
  mcVersion?: string;
  versionsCount: number;
}

interface FtbPackDetail {
  id: number;
  name: string;
  synopsis: string;
  authors: { name: string }[];
  installs: number;
  art: { type: string; url: string }[];
  versions: { id: number; name: string; type: string }[];
}

interface FtbVersionDetail {
  id: number;
  name: string;
  targets: { name: string; version: string; type: string }[];
  specs: { minimum: number; recommended: number };
  files: {
    id: number;
    path: string;
    name: string;
    url: string;
    size: number;
    sha1?: string;
    clientonly: boolean;
    serveronly: boolean;
    optional: boolean;
    type: string;
  }[];
}

let packsCache: FtbPackSummary[] | null = null;
let packsCacheAt = 0;

/** Liste les modpacks FTB (mise en cache 10 minutes, recherche côté client). */
export async function listFtbPacks(query?: string): Promise<FtbPackSummary[]> {
  if (!packsCache || Date.now() - packsCacheAt > 10 * 60 * 1000) {
    const all = await ftbJson<{ packs: number[] }>(`${FTB_API}/modpack/all`);
    const ids = (all.packs ?? []).filter((n) => Number.isFinite(n));
    const details = await Promise.all(
      ids.map((id) =>
        ftbJson<FtbPackDetail>(`${FTB_API}/modpack/${id}`).catch(() => null),
      ),
    );
    packsCache = details
      .filter((d): d is FtbPackDetail => d !== null && typeof d?.name === "string")
      .map((d) => ({
        id: d.id,
        name: d.name,
        synopsis: d.synopsis ?? "",
        authors: d.authors ?? [],
        installs: d.installs ?? 0,
        iconUrl: d.art?.find((a) => a.type === "square")?.url,
        splashUrl: d.art?.find((a) => a.type === "splash")?.url,
        versionsCount: d.versions?.length ?? 0,
      }));
    packsCacheAt = Date.now();
    getLogger().info("ftb", `${packsCache.length} modpacks FTB référencés.`);
  }
  const q = (query ?? "").trim().toLowerCase();
  const list = q
    ? packsCache.filter((p) => p.name.toLowerCase().includes(q) || p.synopsis.toLowerCase().includes(q))
    : [...packsCache].sort((a, b) => b.installs - a.installs).slice(0, 40);
  // Résout la version Minecraft de la dernière version pour l'affichage (limité aux 40 premiers).
  await Promise.all(
    list.slice(0, 40).map(async (p) => {
      if (p.mcVersion) return;
      try {
        const detail = await ftbJson<FtbPackDetail>(`${FTB_API}/modpack/${p.id}`);
        const latest = detail.versions?.[detail.versions.length - 1];
        if (latest) {
          const v = await ftbJson<FtbVersionDetail>(`${FTB_API}/modpack/${p.id}/${latest.id}`);
          p.mcVersion = v.targets?.find((t) => t.type === "game" || t.name === "minecraft")?.version;
        }
      } catch {
        /* affichage sans version */
      }
    }),
  );
  return list.slice(0, 40);
}

/** Mappe un nom de chargeur FTB vers un type du launcher (exporté pour les tests). */
export function mapLoader(name: string): LoaderType {  const n = name.toLowerCase();
  if (n.includes("neoforge")) return "neoforge";
  if (n.includes("forge")) return "forge";
  if (n.includes("fabric")) return "fabric";
  if (n.includes("quilt")) return "quilt";
  return "vanilla";
}

/** Installe un modpack FTB dans une instance dédiée (fichiers client uniquement). */
export async function installFtbPack(packId: number, versionId?: number): Promise<OperationResult<string>> {
  const log = getLogger();
  try {
    const pack = await ftbJson<FtbPackDetail>(`${FTB_API}/modpack/${packId}`);
    const target = versionId
      ? pack.versions.find((v) => v.id === versionId)
      : pack.versions[pack.versions.length - 1];
    if (!target) return { ok: false, error: "Version du modpack introuvable." };
    const detail = await ftbJson<FtbVersionDetail>(`${FTB_API}/modpack/${packId}/${target.id}`);

    const mc = detail.targets?.find((t) => t.type === "game" || t.name === "minecraft")?.version;
    if (!mc) return { ok: false, error: "Version de Minecraft non indiquée par FTB pour ce pack." };
    const loaderTarget = detail.targets?.find((t) => t.type === "modloader");
    const loader = loaderTarget ? mapLoader(loaderTarget.name) : "vanilla";
    const mem = Math.max(3072, detail.specs?.recommended ?? 4096);

    const created = createInstance({
      name: `${pack.name} ${target.name}`.slice(0, 80),
      description: `Modpack FTB « ${pack.name} » (${target.name})`,
      minecraftVersion: mc,
      loader,
      loaderVersion: loaderTarget?.version,
      memoryMinMb: Math.min(2048, mem),
      memoryMaxMb: mem,
    });
    if (!created.ok || !created.data) return { ok: false, error: created.error ?? "Création d'instance impossible." };
    const instance = created.data;

    let queued = 0;
    let skippedServer = 0;
    for (const f of detail.files ?? []) {
      if (f.serveronly) {
        skippedServer += 1;
        continue;
      }
      if (!f.url || !f.path) continue;
      // Les chemins FTB sont relatifs (./mods/...) ; on les normalise et on les confine à l'instance.
      const rel = f.path.replace(/^\.\//, "").replace(/\\/g, "/");
      if (!isSafeArchivePath(instance.directory, rel)) {
        log.warn("ftb", `Chemin refusé (sécurité) : ${f.path}`);
        continue;
      }
      const dest = path.join(instance.directory, rel);
      if (!fs.existsSync(dest)) {
        await enqueueDownload({
          label: f.name || sanitizeFileName(rel.split("/").pop() ?? "fichier"),
          url: f.url,
          destination: dest,
          expectedSize: f.size || undefined,
          sha1: f.sha1 || undefined,
        });
        queued += 1;
      }
    }
    log.info("ftb", `Pack « ${pack.name} » : ${queued} fichier(s) en file (${skippedServer} fichier(s) serveur ignorés).`);
    return { ok: true, data: instance.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Installation FTB impossible." };
  }
}
