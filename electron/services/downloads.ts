import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import type { DownloadItem, DownloadStatus } from "../../shared/types.js";
import { getLogger, getDataDir } from "./store.js";
import { loadSettings } from "./settings.js";

export type ProgressCallback = (items: DownloadItem[]) => void;

interface QueueEntry extends DownloadItem {
  controller: AbortController;
  startedAt: number;
}

const queue = new Map<string, QueueEntry>();
let activeCount = 0;
let emit: ProgressCallback = () => {};

export function setDownloadEmitter(cb: ProgressCallback): void {
  emit = cb;
}

function broadcast(): void {
  emit(listDownloads());
}

export function listDownloads(): DownloadItem[] {
  return [...queue.values()].map(({ controller: _c, startedAt: _s, ...rest }) => ({ ...rest }));
}

function hashFileSha1(file: string): string {
  const hash = createHash("sha1");
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(1024 * 1024);
    let pos = 0;
    for (;;) {
      const read = fs.readSync(fd, buf, 0, buf.length, pos);
      if (read === 0) break;
      hash.update(buf.subarray(0, read));
      pos += read;
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

async function fileExistsAndValid(dest: string, size?: number, sha1?: string): Promise<boolean> {
  try {
    const stat = fs.statSync(dest);
    if (size !== undefined && stat.size !== size) return false;
    if (sha1 && hashFileSha1(dest).toLowerCase() !== sha1.toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function enqueueDownload(opts: {
  id?: string;
  label: string;
  url: string;
  destination: string;
  expectedSize?: number;
  sha1?: string;
}): Promise<DownloadItem> {
  const id = opts.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (queue.has(id)) return listDownloads().find((d) => d.id === id)!;

  fs.mkdirSync(path.dirname(opts.destination), { recursive: true });

  // Évite les téléchargements inutiles : fichier déjà valide.
  if (await fileExistsAndValid(opts.destination, opts.expectedSize, opts.sha1)) {
    const done: DownloadItem = {
      id,
      label: opts.label,
      url: opts.url,
      destination: opts.destination,
      expectedSize: opts.expectedSize,
      sha1: opts.sha1,
      downloadedBytes: opts.expectedSize ?? 0,
      status: "termine",
    };
    getLogger().info("telechargements", `Déjà présent, ignoré : ${opts.label}`);
    return done;
  }

  const settings = loadSettings();
  const entry: QueueEntry = {
    id,
    label: opts.label,
    url: opts.url,
    destination: opts.destination,
    expectedSize: opts.expectedSize,
    sha1: opts.sha1,
    downloadedBytes: 0,
    status: "attente",
    controller: new AbortController(),
    startedAt: 0,
  };
  queue.set(id, entry);
  broadcast();
  void pumpQueue(settings.maxConcurrentDownloads);
  return { ...entry };
}

async function pumpQueue(maxConcurrent: number): Promise<void> {
  while (activeCount < maxConcurrent) {
    const next = [...queue.values()].find((q) => q.status === "attente");
    if (!next) break;
    activeCount += 1;
    void runDownload(next).finally(() => {
      activeCount -= 1;
      void pumpQueue(loadSettings().maxConcurrentDownloads);
    });
  }
}

async function runDownload(entry: QueueEntry): Promise<void> {
  const log = getLogger();
  entry.status = "cours";
  entry.startedAt = Date.now();
  broadcast();

  const settings = loadSettings();
  const partFile = `${entry.destination}.part`;
  let startByte = 0;
  try {
    if (settings.resumeDownloads && fs.existsSync(partFile)) {
      startByte = fs.statSync(partFile).size;
      entry.downloadedBytes = startByte;
    } else if (fs.existsSync(partFile)) {
      fs.unlinkSync(partFile);
    }
  } catch {
    startByte = 0;
  }

  const t0 = Date.now();
  try {
    const headers: Record<string, string> = { "User-Agent": "ApexLauncher/1.0" };
    if (startByte > 0) headers.Range = `bytes=${startByte}-`;
    const res = await fetch(entry.url, { headers, signal: entry.controller.signal });
    if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status} pour ${entry.label}`);
    if (!res.body) throw new Error("Réponse vide du serveur.");

    const total = entry.expectedSize ?? (res.headers.get("content-length") ? Number(res.headers.get("content-length")) + startByte : undefined);
    if (total) entry.expectedSize = total;

    const out = fs.createWriteStream(partFile, { flags: startByte > 0 ? "a" : "w" });
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        entry.downloadedBytes += chunk.length;
        const elapsed = (Date.now() - t0) / 1000;
        if (elapsed > 0.5) {
          entry.speedBps = Math.round(entry.downloadedBytes / elapsed);
          if (entry.expectedSize && entry.speedBps > 0) {
            entry.etaSeconds = Math.max(0, Math.round((entry.expectedSize - entry.downloadedBytes) / entry.speedBps));
          }
        }
        cb(null, chunk);
      },
    });

    let lastEmit = 0;
    counter.on("data", () => {
      const now = Date.now();
      if (now - lastEmit > 250) {
        lastEmit = now;
        broadcast();
      }
    });

    await pipeline(res.body as never, counter, out);

    entry.status = "verification";
    broadcast();

    if (entry.expectedSize !== undefined) {
      const actual = fs.statSync(partFile).size;
      if (actual !== entry.expectedSize) throw new Error(`Taille inattendue (${actual} octets au lieu de ${entry.expectedSize}).`);
    }
    if (entry.sha1) {
      const actualHash = hashFileSha1(partFile);
      if (actualHash.toLowerCase() !== entry.sha1.toLowerCase()) {
        throw new Error("Somme de contrôle SHA-1 invalide. Le fichier sera retéléchargé.");
      }
    }

    entry.status = "installation";
    broadcast();
    fs.renameSync(partFile, entry.destination);
    entry.status = "termine";
    log.info("telechargements", `Téléchargé : ${entry.label}`);
  } catch (err) {
    const aborted = entry.controller.signal.aborted;
    entry.status = aborted ? "annule" : "echec";
    entry.error = aborted ? "Téléchargement annulé." : err instanceof Error ? err.message : "Échec du téléchargement.";
    log.error("telechargements", `${entry.label} : ${entry.error}`);
    try {
      if (!aborted && fs.existsSync(partFile) && !settings.resumeDownloads) fs.unlinkSync(partFile);
    } catch {
      /* ignore */
    }
  }
  broadcast();
}

export function cancelDownload(id: string): boolean {
  const entry = queue.get(id);
  if (!entry) return false;
  if (entry.status === "termine" || entry.status === "annule") return false;
  entry.controller.abort();
  if (entry.status === "attente") {
    entry.status = "annule";
    entry.error = "Téléchargement annulé.";
    broadcast();
  }
  return true;
}

export function retryDownload(id: string): boolean {
  const entry = queue.get(id);
  if (!entry || entry.status !== "echec") return false;
  entry.status = "attente";
  entry.error = undefined;
  entry.downloadedBytes = 0;
  entry.controller = new AbortController();
  broadcast();
  void pumpQueue(loadSettings().maxConcurrentDownloads);
  return true;
}

export function downloadsDir(): string {
  return path.join(getDataDir(), "downloads");
}
