import { app } from "electron";
import path from "node:path";
import fs from "node:fs";
import type { LogEntry } from "../../shared/types.js";
import { APP_CONFIG } from "../../shared/config.js";

const SENSITIVE_PATTERNS: RegExp[] = [
  /"access_token"\s*:\s*"[^"]*"/gi,
  /"refresh_token"\s*:\s*"[^"]*"/gi,
  /accessToken["']?\s*[:=]\s*["'][^"']*["']/gi,
  /refreshToken["']?\s*[:=]\s*["'][^"']*["']/gi,
  /minecraft[a-z_]*token["']?\s*[:=]\s*["'][^"']*["']/gi,
  /xsts[a-z_]*token/gi,
  /Authorization:\s*Bearer\s+\S+/gi,
  /password["']?\s*[:=]\s*["'][^"']*["']/gi,
  /client[_-]?secret["']?\s*[:=]\s*["'][^"']*["']/gi,
  /XBL3\.0 x=[^;\s]+/gi,
];

/** Masque les secrets avant tout stockage dans les journaux. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SENSITIVE_PATTERNS) {
    out = out.replace(pattern, "[MASQUÉ]");
  }
  // Bouts de JWT résiduels
  out = out.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "[MASQUÉ]");
  return out;
}

export function getDataDir(): string {
  const override = process.env.APEX_DATA_DIR;
  if (override && override.trim()) return override;
  try {
    return path.join(app.getPath("appData"), APP_CONFIG.dataDirName);
  } catch {
    return path.join(process.cwd(), "apex-data-dev");
  }
}

export function ensureDataDirs(): void {
  const base = getDataDir();
  for (const sub of ["", "instances", "versions", "libraries", "assets", "backups", "downloads", "avatars", "logs", "cache"]) {
    fs.mkdirSync(path.join(base, sub), { recursive: true });
  }
}

function readJsonFile<T>(file: string, fallback: T): { data: T; migrated: boolean } {
  try {
    if (!fs.existsSync(file)) return { data: fallback, migrated: false };
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = JSON.parse(raw) as { version?: number; data?: T } | T;
    if (parsed && typeof parsed === "object" && "data" in (parsed as Record<string, unknown>)) {
      return { data: (parsed as { data: T }).data, migrated: false };
    }
    // Ancien format sans enveloppe : migrer vers le nouveau format.
    return { data: parsed as T, migrated: true };
  } catch {
    // Données corrompues : ne jamais supprimer silencieusement.
    try {
      const backup = `${file}.corrompu-${Date.now()}.bak`;
      fs.copyFileSync(file, backup);
    } catch {
      /* ignore */
    }
    return { data: fallback, migrated: false };
  }
}

function writeJsonFile<T>(file: string, data: T, version = 1): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ version, data }, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

export function loadJson<T>(name: string, fallback: T): T {
  const file = path.join(getDataDir(), name);
  const { data, migrated } = readJsonFile<T>(file, fallback);
  if (migrated) writeJsonFile(file, data);
  return data;
}

export function saveJson<T>(name: string, data: T): void {
  writeJsonFile(path.join(getDataDir(), name), data);
}

// --- Journalisation persistante ---

const MAX_LOG_ENTRIES = 2000;

class Logger {
  private memory: LogEntry[] = [];

  private append(level: LogEntry["level"], source: string, message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message: redactSecrets(message).slice(0, 4000),
    };
    this.memory.push(entry);
    if (this.memory.length > MAX_LOG_ENTRIES) this.memory.splice(0, this.memory.length - MAX_LOG_ENTRIES);
    try {
      const line = `[${entry.timestamp}] [${level.toUpperCase()}] [${source}] ${entry.message}\n`;
      fs.appendFileSync(path.join(getDataDir(), "logs", "launcher.log"), line, "utf-8");
    } catch {
      /* journal indisponible : on garde la mémoire */
    }
  }

  info(source: string, message: string): void {
    this.append("info", source, message);
  }
  warn(source: string, message: string): void {
    this.append("warn", source, message);
  }
  error(source: string, message: string): void {
    this.append("error", source, message);
  }
  debug(source: string, message: string): void {
    this.append("debug", source, message);
  }

  list(limit = 500): LogEntry[] {
    return this.memory.slice(-limit);
  }
}

let loggerInstance: Logger | null = null;
export function getLogger(): Logger {
  if (!loggerInstance) loggerInstance = new Logger();
  return loggerInstance;
}
