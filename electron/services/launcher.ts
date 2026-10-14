import { spawn, ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Instance, Account, OperationResult } from "../../shared/types.js";
import { APP_VERSION } from "../../shared/version.js";
import { getDataDir, getLogger } from "./store.js";
import { loadSettings, validateMemory } from "./settings.js";
import { getVersionJson, buildClasspath, ensureAssets, waitForDownloadsDrained, installVersion, extractNatives } from "./versions.js";
import { resolveJava, recommendedJavaMajor } from "./java.js";
import { getMinecraftAccessToken } from "./accounts.js";
import { getInstance, touchPlayed, updateInstance } from "./instances.js";
import { installLoader, checkLoaderCompatibility } from "./loaders.js";

let currentProcess: ChildProcess | null = null;
let gameOutput: string[] = [];
let lastExit: { code: number | null; at: number; instanceId: string } | null = null;

export type LaunchStatus =
  | { phase: "preparation" | "telechargement" | "verification" | "lancement" | "jeu"; message: string }
  | { phase: "termine" | "erreur"; message: string };

export function getGameOutput(): string[] {
  return gameOutput.slice(-500);
}

export function getLastExit(): typeof lastExit {
  return lastExit;
}

export async function play(
  instanceId: string,
  account: Account,
  server?: { address: string; port?: number },
  onStatus?: (s: LaunchStatus) => void,
): Promise<OperationResult> {
  const log = getLogger();
  const emit = (s: LaunchStatus) => {
    log.info("lancement", s.message);
    onStatus?.(s);
  };
  const instance = getInstance(instanceId);
  if (!instance) return { ok: false, error: "Instance introuvable." };
  if (!account) return { ok: false, error: "Sélectionnez un profil avant de jouer." };
  if (currentProcess) return { ok: false, error: "Le jeu est déjà en cours d'exécution." };

  try {
    emit({ phase: "preparation", message: `Préparation de « ${instance.name} »…` });

    const totalMb = Math.round(os.totalmem() / 1024 / 1024);
    const memError = validateMemory(instance.memoryMinMb, instance.memoryMaxMb, totalMb);
    if (memError) return { ok: false, error: memError };

    const compat = checkLoaderCompatibility(instance.loader, instance.minecraftVersion);
    if (compat) return { ok: false, error: compat };

    // Compte Microsoft : vérifier les droits avant le lancement (jamais de faux jeton).
    const auth = await getMinecraftAccessToken(account);
    if (!auth) {
      return {
        ok: false,
        error: account.type === "microsoft"
          ? "Session Microsoft expirée ou jeu non possédé. Reconnectez-vous dans le gestionnaire de comptes."
          : "Profil invalide.",
      };
    }

    // Version + chargeur
    emit({ phase: "telechargement", message: `Vérification de Minecraft ${instance.minecraftVersion}…` });
    const install = await installVersion(instance.minecraftVersion);
    if (!install.ok) return { ok: false, error: install.error };

    let versionId = instance.minecraftVersion;
    if (instance.loader !== "vanilla") {
      const res = await installLoader(instance.loader, instance.loaderVersion, instance.minecraftVersion);
      if (!res.ok) return { ok: false, error: res.error };
      versionId = res.data!;
    }

    const vjson = await getVersionJson(versionId);
    await ensureAssets(instance.minecraftVersion);
    emit({ phase: "verification", message: "Vérification des fichiers…" });
    const drained = await waitForDownloadsDrained();
    if (!drained) return { ok: false, error: "Téléchargement trop long ou interrompu. Réessayez." };

    // Java : détection et installation automatiques selon la version de Minecraft.
    // Le chemin résolu est mémorisé pour l'instance afin d'éviter toute nouvelle détection.
    const neededMajor = recommendedJavaMajor(instance.minecraftVersion);
    if (!instance.javaPath || !fs.existsSync(instance.javaPath)) {
      emit({ phase: "verification", message: `Java ${neededMajor} requis — détection et préparation automatiques…` });
    }
    const java = await resolveJava(instance.minecraftVersion, instance.javaPath || loadSettings().defaultJavaPath);
    if (!java.ok || !java.data) return { ok: false, error: java.error ?? "Java introuvable. Voir la page Java." };
    let javaBin = java.data;
    if (/javaw\.exe$/i.test(javaBin)) {
      const sibling = javaBin.replace(/javaw\.exe$/i, "java.exe");
      if (fs.existsSync(sibling)) javaBin = sibling;
    }
    if (instance.javaPath !== javaBin) {
      updateInstance(instance.id, { javaPath: javaBin });
      instance.javaPath = javaBin;
    }

    // Construction de la commande
    const classpath = buildClasspath(versionId, vjson);
    const settings = loadSettings();
    const nativesDir = path.join(getDataDir(), "versions", versionId, "natives");
    fs.mkdirSync(nativesDir, { recursive: true });

    const jvm: string[] = [
      `-Xms${instance.memoryMinMb}M`,
      `-Xmx${instance.memoryMaxMb}M`,
      `-Djava.library.path=${nativesDir}`,
      "-Dminecraft.launcher.brand=ApexLauncher",
      `-Dminecraft.launcher.version=${APP_VERSION}`,
      ...splitJvmArgs(instance.jvmArgs || settings.defaultJvmArgs || ""),
      "-cp", classpath,
      vjson.mainClass,
    ];
    const gameDir = instance.directory;
    const assetsDir = path.join(getDataDir(), "assets");
    const assetIndex = vjson.assetIndex?.id ?? vjson.assets ?? instance.minecraftVersion;

    await extractNatives(versionId, vjson, nativesDir);

    const gameArgs = interpolateArgs(vjson, { gameDir, assetsDir, assetIndex, version: versionId, auth, account });
    const finalArgs = [...jvm, ...gameArgs];

    const width = instance.windowWidth ?? settings.defaultWidth;
    const height = instance.windowHeight ?? settings.defaultHeight;

    const extraGame = [`--width`, String(width), `--height`, String(height)];
    if (server) extraGame.push("--server", server.address, "--port", String(server.port ?? 25565));
    if ((instance.fullscreen ?? settings.defaultFullscreen)) extraGame.push("--fullscreen");

    emit({ phase: "lancement", message: "Lancement de Minecraft…" });
    gameOutput = [];
    await launchProcess(javaBin, [...finalArgs, ...extraGame], gameDir, instance, emit);
    touchPlayed(instance.id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Échec du lancement.";
    log.error("lancement", message);
    emit({ phase: "erreur", message });
    return { ok: false, error: message };
  }
}

function interpolateArgs(
  vjson: Awaited<ReturnType<typeof getVersionJson>>,
  ctx: { gameDir: string; assetsDir: string; assetIndex: string; version: string; auth: { token: string; uuid: string }; account: Account },
): string[] {
  const map: Record<string, string> = {
    auth_player_name: ctx.account.displayName,
    version_name: ctx.version,
    game_directory: ctx.gameDir,
    assets_root: ctx.assetsDir,
    assets_index_name: ctx.assetIndex,
    auth_uuid: ctx.auth.uuid,
    auth_access_token: ctx.auth.token,
    user_type: ctx.account.type === "microsoft" ? "msa" : "legacy",
    version_type: "release",
    game_assets: ctx.assetsDir,
  };
  const out: string[] = [];
  const pushValue = (v: unknown) => {
    if (typeof v === "string") {
      out.push(v.replace(/\$\{(.+?)\}/g, (_, k: string) => map[k] ?? ""));
    }
  };
  const args = vjson.arguments?.game;
  if (Array.isArray(args)) {
    for (const a of args) {
      if (typeof a === "string") pushValue(a);
      else if (a && typeof a === "object") {
        const rule = a as { rules?: { action: string; features?: Record<string, boolean>; os?: { name?: string } }[]; value?: unknown };
        if (checkRules(rule.rules)) {
          if (Array.isArray(rule.value)) rule.value.forEach(pushValue);
          else pushValue(rule.value);
        }
      }
    }
  } else if (vjson.minecraftArguments) {
    for (const part of vjson.minecraftArguments.split(" ")) {
      pushValue(part.replace(/\$\{(.+?)\}/g, (_, k: string) => map[k] ?? ""));
    }
  }
  return out.filter((s) => s !== "");
}

/** Découpe des arguments JVM saisis par l'utilisateur (respecte les guillemets). */
function splitJvmArgs(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const token = m[1] ?? m[2] ?? m[3];
    if (token && !/^-Xms|^-Xmx|^-cp$|^-classpath$/.test(token)) out.push(token);
  }
  return out;
}

function checkRules(rules?: { action: string; features?: Record<string, boolean>; os?: { name?: string } }[]): boolean {
  if (!rules) return true;
  const platform = os.platform() === "win32" ? "windows" : os.platform() === "darwin" ? "osx" : "linux";
  let allowed = false;
  for (const r of rules) {
    const osOk = !r.os?.name || r.os.name === platform;
    const featOk = !r.features || Object.values(r.features).every((v) => v === false);
    if (osOk && featOk) allowed = r.action === "allow";
  }
  return allowed;
}

function launchProcess(
  javaBin: string,
  args: string[],
  cwd: string,
  instance: Instance,
  emit: (s: LaunchStatus) => void,
): Promise<void> {
  const log = getLogger();
  return new Promise((resolve, reject) => {
    const child = spawn(javaBin, args, { cwd, windowsHide: true });
    currentProcess = child;
    emit({ phase: "jeu", message: "Minecraft est en cours d'exécution." });

    child.stdout?.on("data", (d: Buffer) => {
      const line = d.toString().slice(0, 2000);
      gameOutput.push(line);
      if (/ERROR|FATAL|Exception/i.test(line)) log.error("jeu", line.slice(0, 500));
    });
    child.stderr?.on("data", (d: Buffer) => {
      const line = d.toString().slice(0, 2000);
      gameOutput.push(line);
    });
    child.on("error", (err) => {
      currentProcess = null;
      lastExit = { code: null, at: Date.now(), instanceId: instance.id };
      reject(new Error(`Impossible de démarrer Java : ${err.message}. Vérifiez le chemin Java dans les paramètres.`));
    });
    child.on("close", (code) => {
      currentProcess = null;
      lastExit = { code, at: Date.now(), instanceId: instance.id };
      if (code === 0) {
        emit({ phase: "termine", message: "Minecraft s'est fermé normalement." });
        resolve();
      } else {
        const hint = diagnoseExit(code, gameOutput.join("\n"));
        emit({ phase: "erreur", message: `Minecraft s'est fermé (code ${code}). ${hint}` });
        resolve();
      }
    });
  });
}

/** Diagnostic prudent : cause plausible uniquement si les indices le justifient. */
export function diagnoseExit(code: number | null, output: string): string {
  if (/OutOfMemory|Could not reserve enough space/i.test(output)) {
    return "Cause probable : mémoire insuffisante. Réduisez la RAM allouée ou fermez d'autres applications.";
  }
  if (/java\.lang\.UnsupportedClassVersionError|class file version/i.test(output)) {
    return "Cause probable : version de Java inadaptée. Laissez le launcher choisir Java automatiquement (page Java).";
  }
  if (/Could not find or load main class/i.test(output)) {
    return "Cause probable : installation incomplète. Relancez pour terminer la vérification des fichiers.";
  }
  if (/GLFW|Pixel format|opengl/i.test(output)) {
    return "Cause probable : pilotes graphiques. Mettez à jour les pilotes de votre carte graphique.";
  }
  return "Consultez la sortie du jeu dans « Captures et journaux » pour plus de détails.";
}

export function cancelGame(): boolean {
  if (!currentProcess) return false;
  currentProcess.kill();
  return true;
}

export function isGameRunning(): boolean {
  return currentProcess !== null;
}

export type { Instance };
