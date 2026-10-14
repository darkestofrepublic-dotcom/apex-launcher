import fs from "node:fs";
import path from "node:path";
import type { InstalledMod, OperationResult } from "../../shared/types.js";
import { getLogger } from "./store.js";

export function modsDir(instanceDir: string): string {
  return path.join(instanceDir, "mods");
}

export function shaderpacksDir(instanceDir: string): string {
  return path.join(instanceDir, "shaderpacks");
}

export function listMods(instanceDir: string): InstalledMod[] {
  const dir = modsDir(instanceDir);
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => f.endsWith(".jar") || f.endsWith(".jar.disabled"))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        const enabled = f.endsWith(".jar");
        return { fileName: f, enabled, size: stat.size };
      });
  } catch {
    return [];
  }
}

export function toggleMod(instanceDir: string, fileName: string, enabled: boolean): OperationResult {
  return toggleContentFile(modsDir(instanceDir), fileName, enabled, [".jar"]);
}

export function removeMod(instanceDir: string, fileName: string): OperationResult {
  return removeContentFile(modsDir(instanceDir), fileName);
}

export function listShaderpacks(instanceDir: string): InstalledMod[] {
  return listContentFolder(shaderpacksDir(instanceDir), [".zip"]);
}

export function toggleShaderpack(instanceDir: string, fileName: string, enabled: boolean): OperationResult {
  return toggleContentFile(shaderpacksDir(instanceDir), fileName, enabled, [".zip"]);
}

export function removeShaderpack(instanceDir: string, fileName: string): OperationResult {
  return removeContentFile(shaderpacksDir(instanceDir), fileName);
}

function listContentFolder(dir: string, exts: string[]): InstalledMod[] {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter((f) => exts.some((e) => f.toLowerCase().endsWith(e) || f.toLowerCase().endsWith(`${e}.disabled`)))
      .map((f) => {
        const stat = fs.statSync(path.join(dir, f));
        const enabled = !f.toLowerCase().endsWith(".disabled");
        return { fileName: f, enabled, size: stat.size };
      });
  } catch {
    return [];
  }
}

function toggleContentFile(dir: string, fileName: string, enabled: boolean, exts: string[]): OperationResult {
  const base = path.basename(fileName);
  if (base.includes("..") || path.isAbsolute(base)) return { ok: false, error: "Nom de fichier invalide." };
  const lower = base.toLowerCase();
  const valid = exts.some((e) => lower.endsWith(e) || lower.endsWith(`${e}.disabled`));
  if (!valid) return { ok: false, error: "Format de fichier non pris en charge." };
  const current = path.join(dir, base);
  if (!fs.existsSync(current)) return { ok: false, error: "Fichier introuvable." };
  const targetName = enabled ? base.replace(/\.disabled$/i, "") : /\.disabled$/i.test(base) ? base : `${base}.disabled`;
  try {
    fs.renameSync(current, path.join(dir, targetName));
    getLogger().info("contenus", `${enabled ? "Activé" : "Désactivé"} : ${targetName}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

function removeContentFile(dir: string, fileName: string): OperationResult {
  const base = path.basename(fileName);
  const target = path.join(dir, base);
  if (!path.resolve(target).startsWith(path.resolve(dir) + path.sep)) return { ok: false, error: "Chemin refusé." };
  try {
    fs.rmSync(target, { force: true });
    getLogger().info("contenus", `Supprimé : ${base}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Détection simple de conflits : deux fichiers identiques (même base) actif + désactivé. */
export function detectConflicts(mods: InstalledMod[]): string[] {
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  for (const m of mods) {
    const key = m.fileName.replace(/\.disabled$/, "").toLowerCase();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) warnings.push(`Doublon détecté : ${key} est présent en plusieurs exemplaires.`);
  }
  return warnings;
}
