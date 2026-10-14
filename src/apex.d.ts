import type { IpcChannel, IpcEvent } from "../shared/ipc-channels";

interface ApexApi {
  invoke<T = unknown>(channel: IpcChannel, payload?: unknown): Promise<T>;
  on(event: IpcEvent, listener: (data: unknown) => void): () => void;
}

declare global {
  interface Window {
    apex: ApexApi;
  }
}

export {};
