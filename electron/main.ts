import { app, BrowserWindow, ipcMain, shell, dialog, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { registerIpc } from "./ipc.js";
import { getDataDir, ensureDataDirs, getLogger } from "./services/store.js";

import { APP_VERSION } from "../shared/version.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;

function splashHtml(): string {
  const logo = `<svg width="120" height="120" viewBox="0 0 256 256"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2133"/><stop offset="1" stop-color="#0d1120"/></linearGradient><radialGradient id="g" cx="0.5" cy="0.38" r="0.55"><stop offset="0" stop-color="#4f8cff" stop-opacity="0.55"/><stop offset="1" stop-color="#4f8cff" stop-opacity="0"/></radialGradient><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bcd2ff"/></linearGradient></defs><rect x="8" y="8" width="240" height="240" rx="58" fill="url(#t)"/><rect x="8" y="8" width="240" height="240" rx="58" fill="url(#g)"/><rect x="9.5" y="9.5" width="237" height="237" rx="56.5" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2"/><path d="M46 192 L128 60 L210 192 L174 192 L128 114 L82 192 Z" fill="url(#p)"/><path d="M128 26 L142 40 L128 54 L114 40 Z" fill="#67e8f9"/></svg>`;
  return (
    "data:text/html;charset=utf-8," +
    encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;height:100%;background:transparent;overflow:hidden;
        font-family:"Segoe UI",system-ui,sans-serif;color:#eef1f8;
        display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
        -webkit-app-region:drag;user-select:none}
      .logo{filter:drop-shadow(0 12px 32px rgba(79,140,255,.45));animation:rise .5s ease-out}
      @keyframes rise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
      h1{margin:0;font-size:19px;font-weight:650;letter-spacing:.2px}
      small{color:#9aa5bd;font-size:12px;letter-spacing:1.6px;font-weight:700}
      .bar{width:180px;height:3px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden}
      .bar>div{height:100%;width:40%;border-radius:99px;background:linear-gradient(90deg,#4f8cff,#67e8f9);
        animation:slide 1.1s ease-in-out infinite}
      @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(450%)}}
    </style></head><body>${logo}<h1>Apex Launcher</h1><small>APEXDEVLABS • v${APP_VERSION}</small><div class="bar"><div></div></div></body></html>`)
  );
}

function showSplash(): void {
  splashWindow = new BrowserWindow({
    width: 340,
    height: 420,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  void splashWindow.loadURL(splashHtml());
}

function getRendererEntry(): { file?: string; url?: string } {
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) return { url: devUrl };
  return { file: path.join(__dirname, "../../dist-renderer/index.html") };
}

async function createWindow(): Promise<void> {
  const preloadPath = path.join(__dirname, "preload.js");
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: "Apex Launcher",
    frame: false,
    transparent: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const entry = getRendererEntry();
  if (entry.url) {
    await mainWindow.loadURL(entry.url);
  } else if (entry.file) {
    await mainWindow.loadFile(entry.file);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Révèle la fenêtre principale quand elle est prête, puis referme le splash.
  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      mainWindow?.show();
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 700);
  });
  // Sécurité : ne jamais rester bloqué sur le splash.
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
  }, 20000).unref();

  const sendMaxState = () => {
    mainWindow?.webContents.send("window:max-state", { maximized: mainWindow?.isMaximized() ?? false });
  };
  mainWindow.on("maximize", sendMaxState);
  mainWindow.on("unmaximize", sendMaxState);
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

async function migrateLegacyData(): Promise<void> {
  // Migration douce : si un ancien format est détecté, il est converti (voir store.ts).
  // Cette fonction existe pour documenter le point d'entrée des migrations futures.
}

process.on("uncaughtException", (err) => {
  try {
    getLogger().error("main", `Exception non gérée : ${String(err?.message ?? err)}`);
  } catch {
    // dernier recours : ne jamais faire planter silencieusement sans trace
    fs.appendFileSync(
      path.join(getDataDir(), "crash.log"),
      `${new Date().toISOString()} FATAL ${String((err as Error)?.stack ?? err)}\n`,
    );
  }
  if (mainWindow) {
    void dialog.showMessageBox(mainWindow, {
      type: "error",
      title: "Apex Launcher — Récupération après un incident",
      message:
        "Une erreur inattendue est survenue. Vos mondes, instances et paramètres sont conservés. Consultez la page « Captures et journaux » pour exporter un rapport de diagnostic.",
    });
  }
});

void app.whenReady().then(async () => {
  ensureDataDirs();
  await migrateLegacyData();
  registerIpc({ getMainWindow });
  showSplash();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

export { safeStorage };
