import fs from "node:fs";
import path from "node:path";
import type { OperationResult } from "../../shared/types.js";
import { APP_CONFIG } from "../../shared/config.js";
import { getLogger } from "./store.js";
import { loadSettings } from "./settings.js";
import { enqueueDownload } from "./downloads.js";

const HEADERS = { "User-Agent": "ApexLauncher/1.0 (contact: support)" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, ...init });
  if (!res.ok) throw new Error(`Modrinth indisponible (HTTP ${res.status}). Réessayez plus tard.`);
  return (await res.json()) as T;
}

export interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  icon_url?: string;
  project_type: string;
  downloads: number;
  versions: string[];
  categories: string[];
}

export async function searchModrinth(query: string, opts?: { categories?: string; loaders?: string; gameVersions?: string; limit?: number; projectType?: string }): Promise<ModrinthHit[]> {
  const params = new URLSearchParams({ query, limit: String(opts?.limit ?? 25) });
  const facets: string[][] = [];
  if (opts?.projectType) facets.push([`project_type:${opts.projectType}`]);
  if (opts?.categories) facets.push([`categories:${opts.categories}`]);
  if (opts?.loaders) facets.push([`categories:${opts.loaders}`]);
  if (opts?.gameVersions) facets.push([`versions:${opts.gameVersions}`]);
  if (facets.length) params.set("facets", JSON.stringify(facets));
  const data = await api<{ hits: ModrinthHit[] }>(`${APP_CONFIG.modrinthApi}/search?${params}`);
  return data.hits;
}

export async function getProject(id: string): Promise<unknown> {
  return api(`${APP_CONFIG.modrinthApi}/project/${encodeURIComponent(id)}`);
}

export async function getProjectVersions(projectId: string, gameVersion?: string, loader?: string): Promise<unknown[]> {
  const params = new URLSearchParams();
  if (gameVersion) params.set("game_versions", JSON.stringify([gameVersion]));
  if (loader && loader !== "vanilla") params.set("loaders", JSON.stringify([loader]));
  const q = params.toString();
  return api(`${APP_CONFIG.modrinthApi}/project/${encodeURIComponent(projectId)}/version${q ? `?${q}` : ""}`);
}

interface MrVersionFile { url: string; filename: string; primary: boolean; size: number; hashes: { sha1: string } }
interface MrVersion { id: string; version_number: string; game_versions: string[]; loaders: string[]; dependencies: { project_id?: string }[]; files: MrVersionFile[] }

/** Choisi une version compatible (jamais aveuglément la dernière). */
export function pickCompatibleVersion(versions: MrVersion[], gameVersion: string, loader: string): MrVersion | null {
  const scored = versions.map((v) => {
    let score = 0;
    if (v.game_versions.includes(gameVersion)) score += 2;
    if (loader === "vanilla" || v.loaders.includes(loader)) score += 1;
    return { v, score };
  }).filter((s) => s.score >= 2);
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.v ?? null;
}

export async function installModrinthFile(
  projectId: string,
  instanceDir: string,
  target: "mods" | "resourcepacks" | "shaderpacks" | "datapacks",
  gameVersion: string,
  loader: string,
): Promise<OperationResult<string>> {
  const log = getLogger();
  try {
    const versions = (await getProjectVersions(projectId, gameVersion, loader)) as MrVersion[];
    if (!versions.length) return { ok: false, error: "Aucune version disponible pour ce projet." };
    const chosen = pickCompatibleVersion(versions, gameVersion, loader) ?? versions[0];
    if (!chosen.game_versions.includes(gameVersion)) {
      log.warn("modrinth", `Version ${chosen.version_number} non marquée compatible ${gameVersion} — installation proposée avec avertissement.`);
    }
    const file = chosen.files.find((f) => f.primary) ?? chosen.files[0];
    if (!file) return { ok: false, error: "Aucun fichier téléchargeable pour cette version." };
    const dest = path.join(instanceDir, target === "shaderpacks" ? "shaderpacks" : target, sanitizeFileName(file.filename));
    await enqueueDownload({ label: file.filename, url: file.url, destination: dest, expectedSize: file.size, sha1: file.hashes.sha1 });
    const missing = (chosen.dependencies ?? []).filter((d) => d.project_id).length;
    log.info("modrinth", `Installé : ${file.filename}${missing ? ` (${missing} dépendance(s) à vérifier)` : ""}`);
    return { ok: true, data: dest };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Installation impossible." };
  }
}

export function sanitizeFileName(name: string): string {
  return path.basename(name).replace(/[<>:"|?*\x00-\x1f]/g, "_").slice(0, 180);
}

/** Vérifie qu'un chemin d'archive reste dans le répertoire prévu (anti zip-slip). */
export function isSafeArchivePath(destDir: string, entryName: string): boolean {
  const resolved = path.resolve(destDir, entryName);
  const base = path.resolve(destDir) + path.sep;
  return resolved.startsWith(base) && !path.isAbsolute(entryName);
}

// --- CurseForge (accès officiel, clé requise) ---

function cfHeaders(): Record<string, string> {
  const key = loadSettings().curseforgeApiKey?.trim() || process.env.CURSEFORGE_API_KEY || "";
  return { "User-Agent": "ApexLauncher/1.0", "x-api-key": key };
}

export function curseforgeStatus(): { configured: boolean; hint: string } {
  const key = loadSettings().curseforgeApiKey?.trim() || process.env.CURSEFORGE_API_KEY || "";
  return {
    configured: key.length > 0,
    hint: key.length > 0
      ? "Catalogue CurseForge disponible."
      : "Clé API CurseForge manquante : renseignez-la dans Paramètres > Contenu (obtenue sur console.curseforge.com). En attendant, utilisez Modrinth.",
  };
}

export async function searchCurseforge(query: string, opts?: { gameVersion?: string; classId?: number }): Promise<CfSummary[]> {
  const key = loadSettings().curseforgeApiKey?.trim() || process.env.CURSEFORGE_API_KEY || "";
  if (!key) throw new Error("Clé API CurseForge manquante. Renseignez-la dans Paramètres > Contenu.");
  const params = new URLSearchParams({ gameId: "432", searchFilter: query, pageSize: "25" });
  if (opts?.gameVersion) params.set("gameVersion", opts.gameVersion);
  if (opts?.classId) params.set("classId", String(opts.classId));
  const res = await fetch(`${APP_CONFIG.curseforgeApi}/mods/search?${params}`, { headers: cfHeaders() });
  if (res.status === 403) throw new Error("Clé API CurseForge refusée. Vérifiez votre clé.");
  if (!res.ok) throw new Error(`CurseForge indisponible (HTTP ${res.status}).`);
  const json = (await res.json()) as { data: CfRaw[] };
  // Conformité distribution : CurseForge peut exiger un passage sur le site ; on fournit les liens directs quand l'API les autorise.
  return (json.data ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    summary: m.summary ?? "",
    authors: (m.authors ?? []).map((a) => a.name),
    logoUrl: m.logo?.thumbnailUrl,
    downloadCount: m.downloadCount ?? 0,
  }));
}

interface CfRaw {
  id: number;
  name: string;
  summary?: string;
  authors?: { name: string }[];
  logo?: { thumbnailUrl?: string };
  downloadCount?: number;
}

export interface CfSummary {
  id: number;
  name: string;
  summary: string;
  authors: string[];
  logoUrl?: string;
  downloadCount: number;
}

export async function getCurseforgeDownloadUrl(modId: number, fileId: number): Promise<string> {
  const key = loadSettings().curseforgeApiKey?.trim() || process.env.CURSEFORGE_API_KEY || "";
  if (!key) throw new Error("Clé API CurseForge manquante.");
  const res = await fetch(`${APP_CONFIG.curseforgeApi}/mods/${modId}/files/${fileId}/download-url`, { headers: cfHeaders() });
  if (!res.ok) {
    throw new Error(
      "Téléchargement CurseForge non autorisé via l'API pour ce fichier. Ouvrez la page du projet sur le site CurseForge pour le télécharger manuellement.",
    );
  }
  const json = (await res.json()) as { data: string };
  return json.data;
}

export async function installCurseforgeFile(modId: number, fileId: number, fileName: string, instanceDir: string): Promise<OperationResult<string>> {
  try {
    const url = await getCurseforgeDownloadUrl(modId, fileId);
    const dest = path.join(instanceDir, "mods", sanitizeFileName(fileName));
    await enqueueDownload({ label: fileName, url, destination: dest });
    return { ok: true, data: dest };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Installation impossible." };
  }
}

export interface CurseforgeFile {
  id: number;
  fileName: string;
  gameVersions: string[];
}

/** Liste les fichiers d'un projet CurseForge (pour choisir une version de modpack à installer). */
export async function searchCurseforgeFiles(modId: number): Promise<CurseforgeFile[]> {
  const key = loadSettings().curseforgeApiKey?.trim() || process.env.CURSEFORGE_API_KEY || "";
  if (!key) throw new Error("Clé API CurseForge manquante.");
  const res = await fetch(`${APP_CONFIG.curseforgeApi}/mods/${modId}/files?pageSize=25`, { headers: cfHeaders() });
  if (res.status === 403) throw new Error("Clé API CurseForge refusée. Vérifiez votre clé.");
  if (!res.ok) throw new Error(`CurseForge indisponible (HTTP ${res.status}).`);
  const json = (await res.json()) as { data: { id: number; fileName: string; gameVersions: string[] }[] };
  return (json.data ?? []).map((f) => ({ id: f.id, fileName: f.fileName, gameVersions: f.gameVersions ?? [] }));
}

export function comboLabel(): string {
  void fs;
  return "ok";
}
