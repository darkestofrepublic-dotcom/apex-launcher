import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Instance, LoaderType, OperationResult } from "../../shared/types.js";
import { loadJson, saveJson, getDataDir, getLogger } from "./store.js";
import { loadSettings } from "./settings.js";

const INSTANCES_FILE = "instances.json";

const SUBFOLDERS = ["mods", "config", "resourcepacks", "shaderpacks", "saves", "screenshots", "datapacks"];

export function listInstances(): Instance[] {
  return loadJson<Instance[]>(INSTANCES_FILE, []);
}

function persist(instances: Instance[]): void {
  saveJson(INSTANCES_FILE, instances);
}

function instanceDir(id: string, customBase?: string): string {
  const base = customBase || loadSettings().gameDirectory || path.join(getDataDir(), "instances");
  return path.join(base, id);
}

export function createInstance(opts: {
  name: string;
  description?: string;
  minecraftVersion: string;
  loader?: LoaderType;
  loaderVersion?: string;
  memoryMinMb?: number;
  memoryMaxMb?: number;
  icon?: string;
}): OperationResult<Instance> {
  const name = opts.name.trim();
  if (name.length < 2) return { ok: false, error: "Le nom de l'instance doit contenir au moins 2 caractères." };
  if (!opts.minecraftVersion) return { ok: false, error: "Choisissez une version de Minecraft." };
  const settings = loadSettings();
  const instances = listInstances();
  const id = randomUUID();
  const dir = instanceDir(id);
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const sub of SUBFOLDERS) fs.mkdirSync(path.join(dir, sub), { recursive: true });
  } catch (err) {
    return { ok: false, error: `Impossible de créer le dossier : ${(err as Error).message}` };
  }
  const instance: Instance = {
    id,
    name,
    description: opts.description ?? "",
    minecraftVersion: opts.minecraftVersion,
    loader: opts.loader ?? "vanilla",
    loaderVersion: opts.loaderVersion,
    directory: dir,
    memoryMinMb: opts.memoryMinMb ?? settings.defaultMemoryMinMb,
    memoryMaxMb: opts.memoryMaxMb ?? settings.defaultMemoryMaxMb,
    createdAt: Date.now(),
    playCount: 0,
    icon: opts.icon,
  };
  instances.push(instance);
  persist(instances);
  getLogger().info("instances", `Instance créée : ${name} (${opts.minecraftVersion})`);
  return { ok: true, data: instance };
}

export function updateInstance(id: string, patch: Partial<Instance>): OperationResult<Instance> {
  const instances = listInstances();
  const inst = instances.find((i) => i.id === id);
  if (!inst) return { ok: false, error: "Instance introuvable." };
  if (patch.name !== undefined && patch.name.trim().length < 2) {
    return { ok: false, error: "Le nom de l'instance doit contenir au moins 2 caractères." };
  }
  Object.assign(inst, patch, { id: inst.id, directory: inst.directory });
  persist(instances);
  return { ok: true, data: inst };
}

export function removeInstance(id: string, deleteFiles: boolean): OperationResult {
  const instances = listInstances();
  const inst = instances.find((i) => i.id === id);
  if (!inst) return { ok: false, error: "Instance introuvable." };
  persist(instances.filter((i) => i.id !== id));
  if (deleteFiles) {
    try {
      fs.rmSync(inst.directory, { recursive: true, force: true });
    } catch (err) {
      getLogger().warn("instances", `Dossier non supprimé : ${(err as Error).message}`);
      return { ok: false, error: "L'instance a été retirée de la liste mais son dossier n'a pas pu être supprimé." };
    }
  }
  getLogger().info("instances", `Instance supprimée : ${inst.name}`);
  return { ok: true };
}

export function duplicateInstance(id: string): OperationResult<Instance> {
  const instances = listInstances();
  const src = instances.find((i) => i.id === id);
  if (!src) return { ok: false, error: "Instance introuvable." };
  const created = createInstance({
    name: `${src.name} (copie)`,
    description: src.description,
    minecraftVersion: src.minecraftVersion,
    loader: src.loader,
    loaderVersion: src.loaderVersion,
    memoryMinMb: src.memoryMinMb,
    memoryMaxMb: src.memoryMaxMb,
    icon: src.icon,
  });
  if (!created.ok || !created.data) return created;
  try {
    copyRecursive(src.directory, created.data.directory, ["screenshots"]);
  } catch (err) {
    getLogger().warn("instances", `Copie partielle : ${(err as Error).message}`);
  }
  return created;
}

function copyRecursive(src: string, dest: string, exclude: string[] = []): void {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.includes(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      copyRecursive(s, d, []);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

export function getInstance(id: string): Instance | undefined {
  return listInstances().find((i) => i.id === id);
}

export function touchPlayed(id: string): void {
  const instances = listInstances();
  const inst = instances.find((i) => i.id === id);
  if (!inst) return;
  inst.lastPlayedAt = Date.now();
  inst.playCount += 1;
  persist(instances);
}
