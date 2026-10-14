import { ipcMain, shell, dialog, clipboard, app } from "electron";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { IpcChannel } from "../shared/ipc-channels.js";
import { loadSettings, saveSettings } from "./services/settings.js";
import { getLogger, getDataDir } from "./services/store.js";
import {
  listAccounts, createOfflineAccount, updateOfflineAccount, removeAccount, setActiveAccount,
  getActiveAccount, startMicrosoftLogin, logoutMicrosoft, refreshMicrosoftAccount, microsoftStatus, getAvatarsDir,
} from "./services/accounts.js";
import { listVersions, installVersion, removeVersion } from "./services/versions.js";
import { listInstances, createInstance, updateInstance, removeInstance, duplicateInstance } from "./services/instances.js";
import { play, cancelGame, isGameRunning, getGameOutput, getLastExit } from "./services/launcher.js";
import { listDownloads, cancelDownload, retryDownload, setDownloadEmitter } from "./services/downloads.js";
import { detectJava, resolveJava, recommendedJavaMajor } from "./services/java.js";
import { listLoaderVersions, checkLoaderCompatibility } from "./services/loaders.js";
import { listMods, toggleMod, removeMod, detectConflicts, listShaderpacks, toggleShaderpack, removeShaderpack, shaderpacksDir } from "./services/mods.js";
import { searchModrinth, getProject, getProjectVersions, installModrinthFile, searchCurseforge, installCurseforgeFile, curseforgeStatus } from "./services/content.js";
import { importMrPack, exportMrPack, importCurseforgeZip, installModrinthPack } from "./services/modpacks.js";
import { listServers, saveServer, removeServer, touchServer, listBackups, createBackup, restoreBackup, removeBackup, listHudModules, updateHudModule } from "./services/extras.js";
import { checkForUpdates, downloadUpdate, downloadAndApplyUpdate } from "./services/updates.js";
import { listFtbPacks, installFtbPack } from "./services/ftb.js";
import { listSkins, uploadSkin, setActiveSkin, removeSkin, applySkinToInstance, applySkinToAllModded, skinStatus } from "./services/skins.js";

interface Deps {
  getMainWindow: () => import("electron").BrowserWindow | null;
}

function ok<T>(data?: T) {
  return { ok: true, data };
}
function fail(error: string) {
  return { ok: false, error };
}

export function registerIpc(deps: Deps): void {
  setDownloadEmitter((items) => {
    deps.getMainWindow()?.webContents.send("downloads:progress", items);
  });

  const wrap = (channel: IpcChannel, handler: (payload: never) => Promise<unknown>) => {
    ipcMain.handle(channel, async (_event, payload) => {
      try {
        return await handler(payload as never);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inattendue.";
        getLogger().error("ipc", `${channel} : ${message}`);
        return fail(message);
      }
    });
  };

  wrap("settings:get", async () => ok(loadSettings()));
  wrap("settings:update", async (p: Parameters<typeof saveSettings>[0]) => ok(saveSettings(p ?? {})));
  wrap("settings:export", async () => {
    const win = deps.getMainWindow();
    const res = await dialog.showSaveDialog(win ?? undefined!, { title: "Exporter les paramètres", defaultPath: "apex-parametres.json", filters: [{ name: "JSON", extensions: ["json"] }] });
    if (res.canceled || !res.filePath) return ok(null);
    fs.writeFileSync(res.filePath, JSON.stringify(loadSettings(), null, 2));
    return ok(res.filePath);
  });

  wrap("accounts:list", async () => ok(listAccounts()));
  wrap("accounts:create-offline", async (p: { pseudo: string; avatarPath?: string }) => createOfflineAccount(p.pseudo?.trim() ?? "", p.avatarPath));
  wrap("accounts:update-offline", async (p: { id: string; pseudo: string; avatarPath?: string }) => updateOfflineAccount(p.id, p.pseudo?.trim() ?? "", p.avatarPath));
  wrap("accounts:remove", async (p: { id: string }) => {
    const acc = listAccounts().find((a) => a.id === p.id);
    if (acc?.type === "microsoft") logoutMicrosoft(p.id);
    return removeAccount(p.id);
  });
  wrap("accounts:set-active", async (p: { id: string }) => setActiveAccount(p.id));
  wrap("accounts:get-active", async () => ok({ account: getActiveAccount(), microsoft: microsoftStatus() }));
  wrap("auth:microsoft-start", async () => startMicrosoftLogin(deps.getMainWindow()));
  wrap("auth:microsoft-logout", async (p: { id: string }) => logoutMicrosoft(p.id));
  wrap("auth:microsoft-refresh", async (p: { id: string }) => refreshMicrosoftAccount(p.id));

  wrap("versions:list", async () => {
    try {
      return ok(await listVersions());
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Liste des versions indisponible hors ligne.");
    }
  });
  wrap("versions:install", async (p: { id: string }) => installVersion(p.id));
  wrap("versions:remove", async (p: { id: string }) => removeVersion(p.id));

  wrap("instances:list", async () => ok(listInstances()));
  wrap("instances:create", async (p: Parameters<typeof createInstance>[0]) => {
    const created = createInstance(p);
    // Skin actif pré-configuré sur chaque nouvelle instance moddée (meilleur effort, sans bloquer la création).
    if (created.ok && created.data && created.data.loader !== "vanilla") {
      try {
        const { getActiveSkin } = await import("./services/skins.js");
        if (getActiveSkin()) {
          const applied = await applySkinToInstance(created.data.id);
          if (!applied.ok) getLogger().warn("instances", `Skin non appliqué à « ${created.data.name} » : ${applied.error}`);
        }
      } catch (err) {
        getLogger().warn("instances", `Pré-configuration du skin ignorée : ${(err as Error).message}`);
      }
    }
    return created;
  });
  wrap("instances:update", async (p: { id: string; patch: Parameters<typeof updateInstance>[1] }) => updateInstance(p.id, p.patch));
  wrap("instances:remove", async (p: { id: string; deleteFiles: boolean }) => removeInstance(p.id, p.deleteFiles));
  wrap("instances:duplicate", async (p: { id: string }) => duplicateInstance(p.id));
  wrap("instances:open-folder", async (p: { id: string }) => {
    const inst = listInstances().find((i) => i.id === p.id);
    if (!inst) return fail("Instance introuvable.");
    fs.mkdirSync(inst.directory, { recursive: true });
    await shell.openPath(inst.directory);
    return ok(null);
  });
  wrap("instances:export", async (p: { id: string }) => {
    const win = deps.getMainWindow();
    const res = await dialog.showSaveDialog(win ?? undefined!, { title: "Exporter l'instance (modpack)", defaultPath: "instance.mrpack", filters: [{ name: "Modpack", extensions: ["mrpack"] }] });
    if (res.canceled || !res.filePath) return ok(null);
    return exportMrPack(p.id, res.filePath);
  });
  wrap("instances:import", async () => {
    const win = deps.getMainWindow();
    const res = await dialog.showOpenDialog(win ?? undefined!, { title: "Importer un modpack", filters: [{ name: "Modpack", extensions: ["mrpack"] }], properties: ["openFile"] });
    if (res.canceled || !res.filePaths[0]) return ok(null);
    return importMrPack(res.filePaths[0]);
  });

  wrap("launch:play", async (p: { instanceId: string; serverId?: string }) => {
    const win = deps.getMainWindow();
    const account = getActiveAccount();
    if (!account) return fail("Créez d'abord un profil dans le gestionnaire de comptes.");
    let server: { address: string; port?: number } | undefined;
    if (p.serverId) {
      const s = listServers().find((x) => x.id === p.serverId);
      if (s) {
        if (account.type === "offline") {
          getLogger().warn("lancement", "Connexion avec un profil hors ligne : les serveurs avec authentification refuseront la connexion.");
        }
        server = { address: s.address, port: s.port };
        touchServer(s.id);
      }
    }
    const result = await play(p.instanceId, account, server, (status) => {
      win?.webContents.send("launch:status", status);
    });
    return result;
  });
  wrap("launch:join-server", async (p: { instanceId: string; serverId: string }) => {
    const win = deps.getMainWindow();
    const account = getActiveAccount();
    if (!account) return fail("Créez d'abord un profil dans le gestionnaire de comptes.");
    const s = listServers().find((x) => x.id === p.serverId);
    if (!s) return fail("Serveur introuvable.");
    touchServer(s.id);
    return play(p.instanceId, account, { address: s.address, port: s.port }, (status) => {
      win?.webContents.send("launch:status", status);
    });
  });
  wrap("launch:cancel", async () => ok(cancelGame()));

  wrap("downloads:list", async () => ok(listDownloads()));
  wrap("downloads:cancel", async (p: { id: string }) => ok(cancelDownload(p.id)));
  wrap("downloads:retry", async (p: { id: string }) => ok(retryDownload(p.id)));

  wrap("java:detect", async () => ok({ installs: await detectJava(), totalMb: Math.round(os.totalmem() / 1024 / 1024), freeMb: Math.round(os.freemem() / 1024 / 1024) }));
  wrap("java:select-file", async () => {
    const win = deps.getMainWindow();
    const res = await dialog.showOpenDialog(win ?? undefined!, { title: "Sélectionner java.exe", filters: [{ name: "Java", extensions: ["exe"] }], properties: ["openFile"] });
    return ok(res.canceled ? null : res.filePaths[0] ?? null);
  });
  wrap("java:ensure", async (p: { minecraftVersion: string; preferred?: string }) => {
    const r = await resolveJava(p.minecraftVersion, p.preferred);
    return { ...r, recommended: recommendedJavaMajor(p.minecraftVersion) };
  });

  wrap("loaders:versions", async (p: { loader: "vanilla" | "fabric" | "forge" | "neoforge" | "quilt"; minecraftVersion: string }) => {
    try {
      const compat = checkLoaderCompatibility(p.loader, p.minecraftVersion);
      if (compat) return fail(compat);
      return ok(await listLoaderVersions(p.loader, p.minecraftVersion));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Versions du chargeur indisponibles.");
    }
  });
  wrap("loaders:install", async () => fail("Utilisez le bouton JOUER : le chargeur est installé automatiquement pour l'instance."));

  wrap("mods:list", async (p: { instanceDir: string }) => {
    const mods = listMods(p.instanceDir);
    return ok({ mods, warnings: detectConflicts(mods) });
  });
  wrap("mods:toggle", async (p: { instanceDir: string; fileName: string; enabled: boolean }) => toggleMod(p.instanceDir, p.fileName, p.enabled));
  wrap("mods:remove", async (p: { instanceDir: string; fileName: string }) => removeMod(p.instanceDir, p.fileName));
  wrap("mods:open-folder", async (p: { instanceDir: string }) => {
    const dir = path.join(p.instanceDir, "mods");
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return ok(null);
  });

  wrap("shaders:list", async (p: { instanceDir: string }) => ok(listShaderpacks(p.instanceDir)));
  wrap("shaders:toggle", async (p: { instanceDir: string; fileName: string; enabled: boolean }) => toggleShaderpack(p.instanceDir, p.fileName, p.enabled));
  wrap("shaders:remove", async (p: { instanceDir: string; fileName: string }) => removeShaderpack(p.instanceDir, p.fileName));
  wrap("shaders:open-folder", async (p: { instanceDir: string }) => {
    const dir = shaderpacksDir(p.instanceDir);
    fs.mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
    return ok(null);
  });

  wrap("modrinth:search", async (p: { query: string; projectType?: string; gameVersion?: string; loader?: string }) => {
    try {
      return ok(await searchModrinth(p.query, { projectType: p.projectType, gameVersions: p.gameVersion, loaders: p.loader }));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Recherche impossible.");
    }
  });
  wrap("modrinth:project", async (p: { id: string }) => {
    try {
      return ok(await getProject(p.id));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Projet introuvable.");
    }
  });
  wrap("modrinth:versions", async (p: { id: string; gameVersion?: string; loader?: string }) => {
    try {
      return ok(await getProjectVersions(p.id, p.gameVersion, p.loader));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Versions introuvables.");
    }
  });
  wrap("modrinth:install", async (p: { projectId: string; instanceDir: string; target: "mods" | "resourcepacks" | "shaderpacks" | "datapacks"; gameVersion: string; loader: string }) =>
    installModrinthFile(p.projectId, p.instanceDir, p.target, p.gameVersion, p.loader),
  );

  wrap("curseforge:search", async (p: { query: string; gameVersion?: string; classId?: number }) => {
    try {
      return ok({ results: await searchCurseforge(p.query, { gameVersion: p.gameVersion, classId: p.classId }), status: curseforgeStatus() });
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Recherche impossible.");
    }
  });
  wrap("curseforge:install", async (p: { modId: number; fileId: number; fileName: string; instanceDir: string }) =>
    installCurseforgeFile(p.modId, p.fileId, p.fileName, p.instanceDir),
  );

  wrap("modpacks:import-mrpack", async () => {
    const win = deps.getMainWindow();
    const res = await dialog.showOpenDialog(win ?? undefined!, { title: "Importer un modpack (.mrpack)", filters: [{ name: "Modpack", extensions: ["mrpack"] }], properties: ["openFile"] });
    if (res.canceled || !res.filePaths[0]) return ok(null);
    return importMrPack(res.filePaths[0]);
  });
  wrap("modrinth:install-pack", async (p: { projectId: string }) => {
    if (!p?.projectId) return fail("Modpack non précisé.");
    return installModrinthPack(p.projectId);
  });
  wrap("modpacks:export", async (p: { instanceId: string }) => {
    const win = deps.getMainWindow();
    const res = await dialog.showSaveDialog(win ?? undefined!, { title: "Exporter en .mrpack", defaultPath: "modpack.mrpack", filters: [{ name: "Modpack", extensions: ["mrpack"] }] });
    if (res.canceled || !res.filePath) return ok(null);
    return exportMrPack(p.instanceId, res.filePath);
  });

  wrap("servers:list", async () => ok(listServers()));
  wrap("servers:save", async (p: Parameters<typeof saveServer>[0]) => saveServer(p));
  wrap("servers:remove", async (p: { id: string }) => removeServer(p.id));
  wrap("servers:copy-address", async (p: { id: string }) => {
    const s = listServers().find((x) => x.id === p.id);
    if (!s) return fail("Serveur introuvable.");
    clipboard.writeText(s.port ? `${s.address}:${s.port}` : s.address);
    return ok(null);
  });

  wrap("backups:list", async () => ok(listBackups()));
  wrap("backups:create", async (p: { kind: "monde" | "configuration" | "instance" | "parametres"; name: string; sourceDir: string }) =>
    createBackup(p.kind, p.name, p.sourceDir),
  );
  wrap("backups:restore", async (p: { id: string; destDir: string; confirmOverwrite: boolean }) => restoreBackup(p.id, p.destDir, p.confirmOverwrite));
  wrap("backups:remove", async (p: { id: string }) => removeBackup(p.id));

  wrap("logs:list", async () => ok(getLogger().list(500)));
  wrap("logs:game-output", async () => ok({ output: getGameOutput(), lastExit: getLastExit() }));
  wrap("logs:export-diagnostic", async () => {
    const win = deps.getMainWindow();
    const res = await dialog.showSaveDialog(win ?? undefined!, { title: "Exporter le rapport de diagnostic", defaultPath: "apex-diagnostic.json", filters: [{ name: "JSON", extensions: ["json"] }] });
    if (res.canceled || !res.filePath) return ok(null);
    const report = {
      app: "Apex Launcher",
      version: app.getVersion(),
      platform: `${os.platform()} ${os.arch()} ${os.release()}`,
      memoryMb: { total: Math.round(os.totalmem() / 1024 / 1024), free: Math.round(os.freemem() / 1024 / 1024) },
      logs: getLogger().list(500),
      gameOutput: getGameOutput().slice(-100),
      lastExit: getLastExit(),
      settings: { ...loadSettings(), curseforgeApiKey: loadSettings().curseforgeApiKey ? "[CONFIGURÉE]" : "", microsoftClientId: loadSettings().microsoftClientId ? "[CONFIGURÉ]" : "" },
    };
    fs.writeFileSync(res.filePath, JSON.stringify(report, null, 2));
    return ok(res.filePath);
  });

  wrap("hud:list", async () => ok(listHudModules()));
  wrap("hud:update", async (p: { id: string; patch: Parameters<typeof updateHudModule>[1] }) => updateHudModule(p.id, p.patch));

  wrap("skins:list", async () => ok(listSkins()));
  wrap("skins:upload", async (p: { name?: string }) => {
    const win = deps.getMainWindow();
    const res = await dialog.showOpenDialog(win ?? undefined!, { title: "Importer un skin (PNG 64×64 ou 64×32)", filters: [{ name: "Skin Minecraft", extensions: ["png"] }], properties: ["openFile"] });
    if (res.canceled || !res.filePaths[0]) return ok(null);
    return uploadSkin(res.filePaths[0], p?.name);
  });
  wrap("skins:set-active", async (p: { id: string }) => setActiveSkin(p.id));
  wrap("skins:remove", async (p: { id: string }) => removeSkin(p.id));
  wrap("skins:apply", async (p: { instanceId: string }) => applySkinToInstance(p.instanceId));
  wrap("skins:apply-all", async () => applySkinToAllModded());
  wrap("skins:status", async () => ok(skinStatus()));

  wrap("updates:check", async () => checkForUpdates(loadSettings().updateFeedUrl));
  wrap("updates:download", async (p: { url: string }) => {
    if (!p?.url || !/^https:\/\//.test(p.url)) return fail("URL de mise à jour invalide.");
    return downloadUpdate(p.url);
  });
  wrap("updates:download-and-apply", async (p: { url: string }) => {
    if (!p?.url || !/^https:\/\//.test(p.url)) return fail("URL de mise à jour invalide.");
    return downloadAndApplyUpdate(p.url);
  });

  wrap("window:minimize", async () => {
    deps.getMainWindow()?.minimize();
    return ok(null);
  });
  wrap("window:maximize-toggle", async () => {
    const win = deps.getMainWindow();
    if (!win) return fail("Fenêtre introuvable.");
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return ok(win.isMaximized());
  });
  wrap("window:close", async () => {
    deps.getMainWindow()?.close();
    return ok(null);
  });
  wrap("window:is-maximized", async () => ok(deps.getMainWindow()?.isMaximized() ?? false));

  wrap("ftb:packs", async (p: { query?: string }) => {
    try {
      return ok(await listFtbPacks(p?.query));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Catalogue FTB indisponible.");
    }
  });
  wrap("ftb:install", async (p: { packId: number; versionId?: number }) => {
    if (!p?.packId) return fail("Modpack FTB non précisé.");
    return installFtbPack(p.packId, p.versionId);
  });

  wrap("curseforge:files", async (p: { modId: number }) => {
    try {
      const { searchCurseforgeFiles } = await import("./services/content.js");
      return ok(await searchCurseforgeFiles(p.modId));
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Fichiers introuvables.");
    }
  });
  wrap("curseforge:install-pack", async (p: { modId: number; fileId: number; fileName: string }) => {
    try {
      const { getCurseforgeDownloadUrl } = await import("./services/content.js");
      const url = await getCurseforgeDownloadUrl(p.modId, p.fileId);
      const { downloadsDir } = await import("./services/downloads.js");
      const { enqueueDownload } = await import("./services/downloads.js");
      const dest = path.join(downloadsDir(), p.fileName);
      await enqueueDownload({ label: p.fileName, url, destination: dest });
      const { waitForDownloadsDrained } = await import("./services/versions.js");
      const drained = await waitForDownloadsDrained(20 * 60 * 1000);
      if (!drained) return fail("Téléchargement trop long ou interrompu.");
      return importCurseforgeZip(dest);
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Installation impossible.");
    }
  });

  wrap("system:info", async () => {
    let cacheMb = 0;
    try {
      const cacheDir = path.join(getDataDir(), "cache");
      if (fs.existsSync(cacheDir)) {
        for (const f of fs.readdirSync(cacheDir)) {
          try {
            cacheMb += fs.statSync(path.join(cacheDir, f)).size;
          } catch { /* ignore */ }
        }
      }
    } catch { /* ignore */ }
    return ok({
      dataDir: getDataDir(),
      platform: `${os.platform()} ${os.arch()}`,
      totalMb: Math.round(os.totalmem() / 1024 / 1024),
      freeMb: Math.round(os.freemem() / 1024 / 1024),
      cacheBytes: cacheMb,
      gameRunning: isGameRunning(),
      version: app.getVersion(),
    });
  });
  wrap("system:open-path", async (p: { target: string }) => {
    const allowed = [getDataDir()];
    const resolved = path.resolve(p.target);
    if (!allowed.some((a) => resolved.startsWith(path.resolve(a)))) return fail("Ouverture refusée : dossier non géré par le launcher.");
    await shell.openPath(resolved);
    return ok(null);
  });
  wrap("system:pick-avatar", async () => {
    const win = deps.getMainWindow();
    const res = await dialog.showOpenDialog(win ?? undefined!, { title: "Choisir un avatar", filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }], properties: ["openFile"] });
    if (res.canceled || !res.filePaths[0]) return ok(null);
    const src = res.filePaths[0];
    const stat = fs.statSync(src);
    if (stat.size > 2 * 1024 * 1024) return fail("Image trop lourde (2 Mo maximum).");
    fs.mkdirSync(getAvatarsDir(), { recursive: true });
    const dest = path.join(getAvatarsDir(), `${Date.now()}-${path.basename(src)}`);
    fs.copyFileSync(src, dest);
    return ok(dest);
  });
}
