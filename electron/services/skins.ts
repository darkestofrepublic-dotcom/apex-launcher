import { randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { OperationResult } from "../../shared/types.js";
import { loadJson, saveJson, getDataDir, getLogger } from "./store.js";
import { getInstance, listInstances } from "./instances.js";
import { getActiveAccount } from "./accounts.js";
import { listMods } from "./mods.js";
import { installModrinthFile, sanitizeFileName } from "./content.js";

const SKINS_FILE = "skins.json";
const CSL_PROJECT = "customskinloader";

export interface SkinEntry {
  id: string;
  name: string;
  fileName: string;
  width: number;
  height: number;
  createdAt: number;
}

interface SkinsStore {
  skins: SkinEntry[];
  activeId?: string;
}

export function skinsDir(): string {
  return path.join(getDataDir(), "skins");
}

function loadStore(): SkinsStore {
  return loadJson<SkinsStore>(SKINS_FILE, { skins: [] });
}

function persistStore(store: SkinsStore): void {
  saveJson(SKINS_FILE, store);
}

/** Valide un PNG et lit ses dimensions (signature + chunk IHDR), sans dépendance. */
export function parsePngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 33) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) return null;
  }
  if (buf.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

export function isValidSkinSize(width: number, height: number): boolean {
  return (width === 64 && (height === 64 || height === 32));
}

export function listSkins(): { skins: (SkinEntry & { path: string })[]; activeId?: string } {
  const store = loadStore();
  return {
    skins: store.skins.map((s) => ({ ...s, path: path.join(skinsDir(), s.fileName) })),
    activeId: store.activeId,
  };
}

export function getActiveSkin(): SkinEntry | null {
  const store = loadStore();
  return store.skins.find((s) => s.id === store.activeId) ?? null;
}

export function uploadSkin(sourcePath: string, name?: string): OperationResult<SkinEntry> {
  try {
    if (!fs.existsSync(sourcePath)) return { ok: false, error: "Image introuvable." };
    const stat = fs.statSync(sourcePath);
    if (stat.size > 2 * 1024 * 1024) return { ok: false, error: "Image trop lourde (2 Mo maximum)." };
    const buf = fs.readFileSync(sourcePath);
    const dims = parsePngDimensions(buf);
    if (!dims) return { ok: false, error: "Format invalide : un skin doit être un fichier PNG." };
    if (!isValidSkinSize(dims.width, dims.height)) {
      return { ok: false, error: `Dimensions invalides (${dims.width}×${dims.height}) : un skin fait 64×64 ou 64×32 pixels.` };
    }
    fs.mkdirSync(skinsDir(), { recursive: true });
    const id = randomUUID();
    const fileName = `${id}.png`;
    fs.copyFileSync(sourcePath, path.join(skinsDir(), fileName));
    const entry: SkinEntry = {
      id,
      name: (name?.trim() || `Skin ${new Date().toLocaleDateString("fr-FR")}`).slice(0, 60),
      fileName,
      width: dims.width,
      height: dims.height,
      createdAt: Date.now(),
    };
    const store = loadStore();
    store.skins.push(entry);
    if (!store.activeId) store.activeId = id;
    persistStore(store);
    getLogger().info("skins", `Skin importé : ${entry.name} (${dims.width}×${dims.height})`);
    return { ok: true, data: entry };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Import impossible." };
  }
}

export function setActiveSkin(id: string): OperationResult<SkinEntry> {
  const store = loadStore();
  const skin = store.skins.find((s) => s.id === id);
  if (!skin) return { ok: false, error: "Skin introuvable." };
  store.activeId = id;
  persistStore(store);
  return { ok: true, data: skin };
}

export function removeSkin(id: string): OperationResult {
  const store = loadStore();
  const skin = store.skins.find((s) => s.id === id);
  if (!skin) return { ok: false, error: "Skin introuvable." };
  try {
    fs.rmSync(path.join(skinsDir(), skin.fileName), { force: true });
  } catch {
    /* ignore */
  }
  store.skins = store.skins.filter((s) => s.id !== id);
  if (store.activeId === id) store.activeId = store.skins[0]?.id;
  persistStore(store);
  return { ok: true };
}

function cslInstalled(instanceDir: string): boolean {
  return listMods(instanceDir).some(
    (m) => m.enabled && m.fileName.toLowerCase().includes("customskinloader"),
  );
}

/**
 * Applique le skin actif à une instance moddée :
 * 1. installe le véritable CustomSkinLoader depuis Modrinth (version compatible jeu + chargeur),
 * 2. dépose le skin dans LocalSkin/skins/<pseudo>.png (chemin documenté du mod, vérifié dans son code).
 * Aucun fichier de configuration n'est fabriqué : le mod utilise ses propres réglages par défaut.
 */
export async function applySkinToInstance(instanceId: string, pseudoOverride?: string): Promise<OperationResult<string>> {
  const log = getLogger();
  const instance = getInstance(instanceId);
  if (!instance) return { ok: false, error: "Instance introuvable." };
  if (instance.loader === "vanilla") {
    return { ok: false, error: "Les skins personnalisés nécessitent une instance moddée (Fabric, Forge, NeoForge ou Quilt)." };
  }
  const skin = getActiveSkin();
  if (!skin) return { ok: false, error: "Importez d'abord un skin dans la page Skins." };
  const account = getActiveAccount();
  const pseudo = (pseudoOverride?.trim() || account?.displayName || "").trim();
  if (!pseudo) return { ok: false, error: "Sélectionnez un profil pour nommer le skin." };

  try {
    if (!cslInstalled(instance.directory)) {
      log.info("skins", `Installation de CustomSkinLoader pour ${instance.minecraftVersion} (${instance.loader})…`);
      const installed = await installModrinthFile(CSL_PROJECT, instance.directory, "mods", instance.minecraftVersion, instance.loader);
      if (!installed.ok) {
        return { ok: false, error: `CustomSkinLoader indisponible pour ${instance.minecraftVersion} (${instance.loader}) : ${installed.error}` };
      }
    }
    const skinFolder = path.join(instance.directory, "LocalSkin", "skins");
    fs.mkdirSync(skinFolder, { recursive: true });
    const dest = path.join(skinFolder, `${sanitizeFileName(pseudo)}.png`);
    // Sécurité : le fichier reste strictement dans LocalSkin/skins.
    if (path.resolve(dest).startsWith(path.resolve(skinFolder) + path.sep)) {
      fs.copyFileSync(path.join(skinsDir(), skin.fileName), dest);
    } else {
      return { ok: false, error: "Pseudonyme incompatible avec le dossier du skin." };
    }
    log.info("skins", `Skin « ${skin.name} » appliqué à « ${instance.name} » pour le pseudo ${pseudo}.`);
    return { ok: true, data: dest };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Application impossible." };
  }
}

/** Applique le skin actif à toutes les instances moddées (erreurs collectées, jamais bloquantes). */
export async function applySkinToAllModded(): Promise<OperationResult<{ applied: string[]; skipped: string[]; errors: string[] }>> {
  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  for (const instance of listInstances()) {
    if (instance.loader === "vanilla") {
      skipped.push(instance.name);
      continue;
    }
    const res = await applySkinToInstance(instance.id);
    if (res.ok) applied.push(instance.name);
    else errors.push(`${instance.name} : ${res.error}`);
  }
  return { ok: errors.length === 0, data: { applied, skipped, errors }, error: errors.length ? errors.join(" | ") : undefined };
}

export interface InstanceSkinStatus {
  id: string;
  name: string;
  loader: string;
  minecraftVersion: string;
  modded: boolean;
  hasCustomSkinLoader: boolean;
  skinFiles: string[];
}

export function skinStatus(): InstanceSkinStatus[] {
  return listInstances().map((instance) => {
    let skinFiles: string[] = [];
    try {
      const folder = path.join(instance.directory, "LocalSkin", "skins");
      if (fs.existsSync(folder)) {
        skinFiles = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".png"));
      }
    } catch {
      skinFiles = [];
    }
    return {
      id: instance.id,
      name: instance.name,
      loader: instance.loader,
      minecraftVersion: instance.minecraftVersion,
      modded: instance.loader !== "vanilla",
      hasCustomSkinLoader: cslInstalled(instance.directory),
      skinFiles,
    };
  });
}

/** Empreinte d'un skin (déduplication éventuelle). */
export function skinHash(fileName: string): string | null {
  try {
    const buf = fs.readFileSync(path.join(skinsDir(), fileName));
    return createHash("sha256").update(buf).digest("hex").slice(0, 16);
  } catch {
    return null;
  }
}
