import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onEvent } from "../lib/api";
import type { DownloadItem } from "../../shared/types";

// Contexte dédié : la progression des téléchargements (fréquente) ne re-rend
// que les consommateurs concernés, pas toute l'application.
const DlCtx = createContext<DownloadItem[]>([]);

export function useDownloads(): DownloadItem[] {
  return useContext(DlCtx);
}

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  useEffect(() => {
    return onEvent("downloads:progress", (d) => setDownloads(d as DownloadItem[]));
  }, []);
  return <DlCtx.Provider value={downloads}>{children}</DlCtx.Provider>;
}
