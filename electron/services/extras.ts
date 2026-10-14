import { randomUUID } from "node:crypto";
import type { ServerEntry, BackupEntry, HudModule, OperationResult } from "../../shared/types.js";
import { loadJson, saveJson, getDataDir, getLogger } from "./store.js";
import path from "node:path";
import fs from "node:fs";

const SERVERS_FILE = "serveurs.json";
const BACKUPS_FILE = "sauvegardes.json";
const HUD_FILE = "hud.json";

export function listServers(): ServerEntry[] {
  return loadJson<ServerEntry[]>(SERVERS_FILE, []);
}

export function saveServer(entry: Partial<ServerEntry> & { name: string; address: string }): OperationResult<ServerEntry> {
  const address = entry.address.trim();
  if (!address) return { ok: false, error: "L'adresse du serveur est requise." };
  if (!/^[A-Za-z0-9._:-]+$/.test(address)) return { ok: false, error: "Adresse invalide (lettres, chiffres, points, tirets, deux-points)." };
  if (entry.port !== undefined && (entry.port < 1 || entry.port > 65535)) return { ok: false, error: "Port invalide (1–65535)." };
  const servers = listServers();
  const existing = entry.id ? servers.find((s) => s.id === entry.id) : undefined;
  if (existing) {
    Object.assign(existing, entry);
    saveJson(SERVERS_FILE, servers);
    return { ok: true, data: existing };
  }
  const created: ServerEntry = {
    id: randomUUID(),
    name: entry.name.trim() || address,
    address,
    port: entry.port,
    description: entry.description ?? "",
    category: entry.category ?? "",
    favorite: entry.favorite ?? false,
    lastPlayedAt: undefined,
  };
  servers.push(created);
  saveJson(SERVERS_FILE, servers);
  return { ok: true, data: created };
}

export function removeServer(id: string): OperationResult {
  saveJson(SERVERS_FILE, listServers().filter((s) => s.id !== id));
  return { ok: true };
}

export function touchServer(id: string): void {
  const servers = listServers();
  const s = servers.find((x) => x.id === id);
  if (s) {
    s.lastPlayedAt = Date.now();
    saveJson(SERVERS_FILE, servers);
  }
}

// --- Sauvegardes ---

export function listBackups(): BackupEntry[] {
  return loadJson<BackupEntry[]>(BACKUPS_FILE, []);
}

export async function createBackup(kind: BackupEntry["kind"], name: string, sourceDir: string): Promise<OperationResult<BackupEntry>> {
  try {
    const { default: archiver } = await import("archiver");
    if (!fs.existsSync(sourceDir)) return { ok: false, error: "Dossier source introuvable." };
    const safeName = name.replace(/[<>:"|?*\x00-\x1f]/g, "_").slice(0, 80) || "sauvegarde";
    const filePath = path.join(getDataDir(), "backups", `${safeName}-${Date.now()}.zip`);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const output = fs.createWriteStream(filePath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    await new Promise<void>((resolve, reject) => {
      output.on("close", () => resolve());
      archive.on("error", reject);
      archive.pipe(output);
      archive.directory(sourceDir, false);
      void archive.finalize();
    });
    const entry: BackupEntry = { id: randomUUID(), name: safeName, filePath, size: fs.statSync(filePath).size, createdAt: Date.now(), kind };
    const all = listBackups();
    all.push(entry);
    saveJson(BACKUPS_FILE, all);
    getLogger().info("sauvegardes", `Sauvegarde créée : ${safeName}`);
    return { ok: true, data: entry };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sauvegarde impossible." };
  }
}

export async function restoreBackup(id: string, destDir: string, confirmOverwrite: boolean): Promise<OperationResult> {
  const entry = listBackups().find((b) => b.id === id);
  if (!entry) return { ok: false, error: "Sauvegarde introuvable." };
  if (fs.existsSync(destDir) && fs.readdirSync(destDir).length > 0 && !confirmOverwrite) {
    return { ok: false, error: "Le dossier de destination n'est pas vide : confirmez l'écrasement." };
  }
  try {
    const { default: unzipper } = await import("unzipper");
    const dir = await unzipper.Open.file(entry.filePath);
    const base = path.resolve(destDir);
    for (const file of dir.files) {
      const resolved = path.resolve(destDir, file.path);
      if (!resolved.startsWith(base + path.sep) && resolved !== base) {
        getLogger().warn("sauvegardes", `Entrée refusée (sécurité) : ${file.path}`);
        continue;
      }
      if (file.type === "Directory") {
        fs.mkdirSync(resolved, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        fs.writeFileSync(resolved, await file.buffer());
      }
    }
    getLogger().info("sauvegardes", `Sauvegarde restaurée : ${entry.name}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Restauration impossible." };
  }
}

export function removeBackup(id: string): OperationResult {
  const entry = listBackups().find((b) => b.id === id);
  if (!entry) return { ok: false, error: "Sauvegarde introuvable." };
  try {
    fs.rmSync(entry.filePath, { force: true });
  } catch {
    /* ignore */
  }
  saveJson(BACKUPS_FILE, listBackups().filter((b) => b.id !== id));
  return { ok: true };
}

// --- Modules HUD : états honnêtes ---
// Les modules HUD nécessitent un mod d'accompagnement dans le jeu.
// Sans ce mod installé, ils sont affichés comme « non disponibles » (jamais de faux fonctionnement).

const HUD_DEFINITIONS: Omit<HudModule, "enabled">[] = [
  { id: "fps", name: "FPS", description: "Affiche les images par seconde.", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "cps", name: "CPS", description: "Clics par seconde (bouton gauche/droit).", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "keystrokes", name: "Touches", description: "Affiche les touches pressées.", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "coords", name: "Coordonnées", description: "Position XYZ du joueur.", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "armor", name: "Armure", description: "État de l'armure portée.", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "crosshair", name: "Viseur personnalisé", description: "Viseur configurable.", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "zoom", name: "Zoom", description: "Zoom configurable (touche C par défaut).", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé ou option du jeu." },
  { id: "sprint", name: "Sprint automatique", description: "Bascule du sprint.", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "sneak", name: "Accroupi automatique", description: "Bascule de l'accroupissement.", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
  { id: "playtime", name: "Durée de jeu", description: "Temps de jeu de la session.", available: true },
  { id: "perf", name: "Performances", description: "Mémoire utilisée par le launcher.", available: true },
  { id: "effects", name: "Effets", description: "Effets de potion actifs (nécessite le mod).", available: false, missingDependency: "Mod d'accompagnement « ApexHUD » non installé." },
];

export function listHudModules(): HudModule[] {
  const stored = loadJson<Record<string, Partial<HudModule>>>(HUD_FILE, {});
  return HUD_DEFINITIONS.map((d) => ({ ...d, enabled: false, x: 16, y: 16, scale: 100, opacity: 90, color: "#ffffff", ...(stored[d.id] ?? {}) }));
}

export function updateHudModule(id: string, patch: Partial<HudModule>): OperationResult<HudModule> {
  const modules = listHudModules();
  const mod = modules.find((m) => m.id === id);
  if (!mod) return { ok: false, error: "Module inconnu." };
  if (patch.enabled && !mod.available) {
    return { ok: false, error: `« ${mod.name} » n'est pas disponible : ${mod.missingDependency}` };
  }
  const stored = loadJson<Record<string, Partial<HudModule>>>(HUD_FILE, {});
  stored[id] = { ...(stored[id] ?? {}), ...patch };
  saveJson(HUD_FILE, stored);
  return { ok: true, data: { ...mod, ...patch } };
}
