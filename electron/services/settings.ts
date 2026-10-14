import path from "node:path";
import { app } from "electron";
import type { LauncherSettings } from "../../shared/types.js";
import { loadJson, saveJson, getDataDir } from "./store.js";

const SETTINGS_FILE = "parametres.json";

export function defaultSettings(): LauncherSettings {
  const base = getDataDir();
  let language: LauncherSettings["language"] = "fr";
  try {
    const locale = app?.getLocale?.() ?? "";
    if (locale.toLowerCase().startsWith("en")) language = "en";
  } catch {
    language = "fr";
  }
  return {
    theme: "dark",
    accentColor: "#4f8cff",
    interfaceScale: 100,
    animations: true,
    defaultMemoryMinMb: 1024,
    defaultMemoryMaxMb: 4096,
    defaultJvmArgs: "",
    defaultWidth: 854,
    defaultHeight: 480,
    defaultFullscreen: false,
    gameDirectory: path.join(base, "instances"),
    backupDirectory: path.join(base, "backups"),
    maxConcurrentDownloads: 4,
    resumeDownloads: true,
    diagnosticsEnabled: true,
    language,
    checkUpdatesOnStartup: true,
    transparency: true,
    microsoftClientId: process.env.MICROSOFT_CLIENT_ID || "",
    curseforgeApiKey: process.env.CURSEFORGE_API_KEY || "",
  };
}

export function loadSettings(): LauncherSettings {
  return { ...defaultSettings(), ...loadJson<Partial<LauncherSettings>>(SETTINGS_FILE, {}) };
}

export function saveSettings(patch: Partial<LauncherSettings>): LauncherSettings {
  const current = loadSettings();
  const next = validateSettings({ ...current, ...patch });
  saveJson(SETTINGS_FILE, next);
  return next;
}

export function validateSettings(s: LauncherSettings): LauncherSettings {
  const mem = (v: number, min: number, max: number, fallback: number) =>
    Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : fallback;
  return {
    ...s,
    theme: s.theme === "light" ? "light" : "dark",
    language: s.language === "en" ? "en" : "fr",
    transparency: s.transparency !== false,
    interfaceScale: mem(s.interfaceScale, 75, 150, 100),
    defaultMemoryMinMb: mem(s.defaultMemoryMinMb, 512, 65536, 1024),
    defaultMemoryMaxMb: mem(s.defaultMemoryMaxMb, 1024, 65536, 4096),
    defaultWidth: mem(s.defaultWidth, 640, 7680, 854),
    defaultHeight: mem(s.defaultHeight, 480, 4320, 480),
    maxConcurrentDownloads: mem(s.maxConcurrentDownloads, 1, 8, 4),
  };
}

/** Valide une allocation mémoire avant lancement. */
export function validateMemory(minMb: number, maxMb: number, totalMb: number): string | null {
  if (!Number.isFinite(minMb) || !Number.isFinite(maxMb)) return "Les valeurs de mémoire doivent être des nombres.";
  if (minMb < 512) return "La mémoire minimale doit être d'au moins 512 Mo.";
  if (maxMb < 1024) return "La mémoire maximale doit être d'au moins 1024 Mo.";
  if (minMb > maxMb) return "La mémoire minimale ne peut pas dépasser la mémoire maximale.";
  if (maxMb > totalMb * 0.85) return "Ne réservez pas plus de 85 % de la mémoire totale pour Minecraft.";
  return null;
}
