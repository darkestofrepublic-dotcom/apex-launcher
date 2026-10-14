import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { OperationResult } from "../../shared/types.js";
import { getDataDir, getLogger } from "./store.js";
import { waitForDownloadsDrained } from "./versions.js";

const execFileAsync = promisify(execFile);

export interface JavaInstall {
  path: string;
  version: string;
  major: number;
  source: string;
}

function parseMajor(output: string): { version: string; major: number } {
  const m = output.match(/version "([^"]+)"/) ?? output.match(/(\d+\.\d+\.\d+)/);
  const version = m?.[1] ?? "inconnue";
  const majorMatch = version.match(/^1\.(\d+)/) ?? version.match(/^(\d+)/);
  return { version, major: majorMatch ? Number(majorMatch[1]) : 0 };
}

async function probeJava(binary: string, source: string): Promise<JavaInstall | null> {
  try {
    const { stderr, stdout } = await execFileAsync(binary, ["-version"]);
    const { version, major } = parseMajor(`${stdout}\n${stderr}`);
    if (!major) return null;
    return { path: binary, version, major, source };
  } catch {
    return null;
  }
}

/** Détecte les installations Java disponibles (PATH, dossiers courants, registre simplifié). */
export async function detectJava(): Promise<JavaInstall[]> {
  const found: JavaInstall[] = [];
  const candidates: { bin: string; source: string }[] = [];

  for (const cmd of ["java", "javaw"]) {
    const r = await probeJava(cmd, "PATH");
    if (r) found.push(r);
  }

  const roots: string[] = [];
  for (const base of [
    "C:\\Program Files\\Java",
    "C:\\Program Files (x86)\\Java",
    "C:\\Program Files\\Eclipse Adoptium",
    "C:\\Program Files\\Microsoft",
    path.join(os.homedir(), ".jdks"),
    path.join(getDataDir(), "runtimes"),
  ]) {
    try {
      if (fs.existsSync(base)) {
        for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
          if (entry.isDirectory()) roots.push(path.join(base, entry.name));
        }
      }
    } catch {
      /* ignore */
    }
  }
  for (const root of roots) {
    for (const rel of ["bin\\java.exe", "bin\\javaw.exe"]) {
      candidates.push({ bin: path.join(root, rel), source: root });
    }
  }

  for (const c of candidates) {
    if (fs.existsSync(c.bin)) {
      const r = await probeJava(c.bin, c.source);
      if (r && !found.some((f) => f.path.toLowerCase() === r.path.toLowerCase())) found.push(r);
    }
  }
  return found.sort((a, b) => b.major - a.major);
}

/** Version Java recommandée selon la version de Minecraft. */
export function recommendedJavaMajor(minecraftVersion: string): number {
  const parts = minecraftVersion.split(".").map(Number);
  const minor = parts[1] ?? 0;
  if (parts[0] === 1 && minor >= 20.5) return 21;
  if (parts[0] === 1 && minor >= 18) return 17;
  if (parts[0] === 1 && minor >= 17) return 16;
  return 8;
}

interface RuntimeManifest {
  [osName: string]: {
    [component: string]: { manifest: { url: string; size: number; sha1: string } }[];
  };
}

/** Télécharge un runtime Java Mojang officiel correspondant au composant requis. */
export async function ensureMojangRuntime(component: string): Promise<OperationResult<string>> {
  const log = getLogger();
  try {
    const { APP_CONFIG } = await import("../../shared/config.js");
    const { enqueueDownload } = await import("./downloads.js");
    const manifest = await (await fetch(APP_CONFIG.javaRuntimesManifest)).json() as RuntimeManifest;
    const entries = manifest["windows-x64"]?.[component];
    if (!entries?.length) return { ok: false, error: `Aucun runtime « ${component} » disponible pour Windows x64.` };
    const meta = entries[0];
    const destDir = path.join(getDataDir(), "runtimes", component);
    const javaExe = path.join(destDir, "bin", "java.exe");
    if (fs.existsSync(javaExe)) return { ok: true, data: javaExe };

    // Manifeste du runtime : liste officielle des fichiers à télécharger un par un.
    const details = await (await fetch(meta.manifest.url)).json() as { files: Record<string, { type: string; downloads?: { raw: { url: string; sha1: string; size: number } } }> };
    fs.mkdirSync(destDir, { recursive: true });
    for (const [rel, info] of Object.entries(details.files)) {
      if (info.type === "directory") {
        fs.mkdirSync(path.join(destDir, rel), { recursive: true });
      } else if (info.type === "file" && info.downloads?.raw) {
        const dest = path.join(destDir, rel);
        if (!fs.existsSync(dest)) {
          await enqueueDownload({ label: `Java ${component} — ${rel}`, url: info.downloads.raw.url, destination: dest, expectedSize: info.downloads.raw.size, sha1: info.downloads.raw.sha1 });
        }
      }
    }
    await waitForDownloadsDrained(30 * 60 * 1000);
    if (!fs.existsSync(javaExe)) return { ok: false, error: "Runtime téléchargé mais java.exe introuvable." };
    log.info("java", `Runtime ${component} prêt : ${javaExe}`);
    return { ok: true, data: javaExe };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec du téléchargement Java." };
  }
}

/** Choisit automatiquement un Java compatible ou le télécharge depuis la source officielle Mojang. */
export async function resolveJava(minecraftVersion: string, preferred?: string): Promise<OperationResult<string>> {
  const needed = recommendedJavaMajor(minecraftVersion);
  if (preferred && fs.existsSync(preferred)) {
    const probe = await probeJava(preferred, "manuel");
    if (probe && probe.major >= needed) return { ok: true, data: preferred };
  }
  const all = await detectJava();
  const compatible = all.find((j) => j.major >= needed && j.major <= needed + 4) ?? all.find((j) => j.major >= needed);
  if (compatible) return { ok: true, data: compatible.path };
  const component = needed >= 21 ? "java-runtime-gamma" : needed >= 17 ? "java-runtime-beta" : "jre-legacy";
  return ensureMojangRuntime(component);
}
