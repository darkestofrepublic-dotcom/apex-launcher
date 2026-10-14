import { contextBridge, ipcRenderer } from "electron";
import type { IpcChannel, IpcEvent } from "../shared/ipc-channels.js";

/** API limitée et typée exposée au renderer. Aucun accès Node.js direct. */
const api = {
  invoke<T = unknown>(channel: IpcChannel, payload?: unknown): Promise<T> {
    return ipcRenderer.invoke(channel, payload) as Promise<T>;
  },
  on(event: IpcEvent, listener: (data: unknown) => void): () => void {
    const wrapped = (_e: unknown, data: unknown) => listener(data);
    ipcRenderer.on(event, wrapped as never);
    return () => ipcRenderer.removeListener(event, wrapped as never);
  },
};

export type ApexApi = typeof api;

contextBridge.exposeInMainWorld("apex", api);

declare global {
  interface Window {
    apex: ApexApi;
  }
}
