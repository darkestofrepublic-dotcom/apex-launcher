import type { IpcChannel } from "../../shared/ipc-channels";

async function invoke<T>(channel: IpcChannel, payload?: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  return window.apex.invoke(channel, payload);
}

export async function api<T>(channel: IpcChannel, payload?: unknown): Promise<T> {
  const res = await invoke<T>(channel, payload);
  if (!res.ok) throw new Error(res.error ?? "Erreur inattendue.");
  return res.data as T;
}

export function onEvent(
  event: "downloads:progress" | "launch:status" | "logs:new" | "window:max-state",
  cb: (data: never) => void,
): () => void {
  return window.apex.on(event, cb as (data: unknown) => void);
}
