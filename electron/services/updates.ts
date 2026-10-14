import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { app } from "electron";
import type { OperationResult } from "../../shared/types.js";
import { APP_CONFIG } from "../../shared/config.js";
import { APP_VERSION } from "../../shared/version.js";
import { getLogger } from "./store.js";
import { enqueueDownload } from "./downloads.js";

export interface UpdateInfo {
  currentVersion: string;
  available: boolean;
  latestVersion?: string;
  downloadUrl?: string;
  notes?: string;
  checkedAt: number;
}

/** Compare deux versions semver (retourne 1 si a > b, -1 si a < b, 0 sinon). */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => Number(n) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

interface GithubRelease {
  tag_name: string;
  html_url: string;
  body?: string;
  assets?: { name: string; browser_download_url: string }[];
}

/** Vérifie les mises à jour depuis le flux configuré (releases GitHub par défaut). */
export async function checkForUpdates(feedUrl?: string): Promise<OperationResult<UpdateInfo>> {
  const log = getLogger();
  const url = feedUrl?.trim() || APP_CONFIG.updatesFeed;
  const info: UpdateInfo = { currentVersion: APP_VERSION, available: false, checkedAt: Date.now() };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(url, { headers: { "User-Agent": "ApexLauncher", Accept: "application/vnd.github+json" }, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 404) {
      return { ok: false, error: "update-feed-not-found" };
    }
    if (!res.ok) {
      return { ok: false, error: "update-feed-unreachable" };
    }
    const release = (await res.json()) as GithubRelease;
    const latest = (release.tag_name ?? "").replace(/^v/i, "");
    if (!latest) return { ok: false, error: "update-feed-invalid" };
    info.latestVersion = latest;
    info.notes = (release.body ?? "").slice(0, 2000);
    const setup = release.assets?.find((a) => a.name === APP_CONFIG.installerFileName) ?? release.assets?.find((a) => a.name.endsWith(".exe"));
    info.downloadUrl = setup?.browser_download_url ?? release.html_url;
    info.available = compareVersions(latest, APP_VERSION) > 0;
    log.info("mises-a-jour", info.available ? `Mise à jour disponible : ${latest}` : `À jour (${APP_VERSION}).`);
    return { ok: true, data: info };
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "update-timeout" : "update-feed-unreachable";
    log.warn("mises-a-jour", `Vérification impossible : ${message}`);
    return { ok: false, error: message };
  }
}

/** Télécharge le programme d'installation de la mise à jour (progression réelle). */
export async function downloadUpdate(downloadUrl: string, fileName?: string): Promise<OperationResult<string>> {
  try {
    const { downloadsDir } = await import("./downloads.js");
    const { sanitizeFileName } = await import("./content.js");
    const dest = path.join(downloadsDir(), fileName || sanitizeFileName("ApexLauncher-Setup-x64.exe"));
    const item = await enqueueDownload({ label: `Mise à jour ${APP_VERSION} → installateur`, url: downloadUrl, destination: dest });
    return { ok: true, data: item.destination };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "update-download-failed" };
  }
}

/** Télécharge la mise à jour puis exécute l'installateur (le launcher se ferme pour le laisser travailler). */
export async function downloadAndApplyUpdate(downloadUrl: string): Promise<OperationResult> {
  const log = getLogger();
  if (!/^https:\/\//i.test(downloadUrl)) return { ok: false, error: "URL de mise à jour invalide (HTTPS requis)." };
  try {
    const { downloadsDir } = await import("./downloads.js");
    const { sanitizeFileName } = await import("./content.js");
    const fileName = sanitizeFileName(downloadUrl.split("/").pop()?.split("?")[0] || "ApexLauncher-Setup-x64.exe");
    if (!fileName.toLowerCase().endsWith(".exe")) {
      return { ok: false, error: "Le lien de mise à jour ne pointe pas vers un programme d'installation .exe." };
    }
    const dest = path.join(downloadsDir(), fileName);
    await enqueueDownload({ label: `Mise à jour Apex Launcher (${fileName})`, url: downloadUrl, destination: dest });
    const { waitForDownloadsDrained } = await import("./versions.js");
    const drained = await waitForDownloadsDrained(30 * 60 * 1000);
    if (!drained) return { ok: false, error: "Téléchargement de la mise à jour trop long ou interrompu." };
    if (!fs.existsSync(dest)) return { ok: false, error: "Programme d'installation introuvable après téléchargement." };
    log.info("mises-a-jour", `Application de la mise à jour : ${dest}`);
    const child = spawn(dest, ["/SILENT", "/NORESTART", "/SUPPRESSMSGBOXES"], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
    setTimeout(() => app.quit(), 1500);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Mise à jour impossible." };
  }
}
