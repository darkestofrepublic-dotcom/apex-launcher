// Simulation du module "electron" pour les tests unitaires (aucun binaire Electron requis).
import path from "node:path";
import os from "node:os";

export const app = {
  getPath: (name: string) => {
    if (name === "appData") return path.join(os.tmpdir(), "apex-test-appdata");
    if (name === "userData") return path.join(os.tmpdir(), "apex-test-userdata");
    return os.tmpdir();
  },
  getVersion: () => "1.0.0-test",
};

export const safeStorage = {
  isEncryptionAvailable: () => false,
  encryptString: (s: string) => Buffer.from(s),
  decryptString: (b: Buffer) => b.toString(),
};

export class BrowserWindow {}
export const ipcMain = { handle: () => {} };
export const shell = { openPath: async () => "", openExternal: async () => {} };
export const dialog = { showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }) };
export const clipboard = { writeText: () => {} };
export default { app, safeStorage, BrowserWindow, ipcMain, shell, dialog, clipboard };
