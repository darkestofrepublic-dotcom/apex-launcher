import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, onEvent } from "../lib/api";
import { STRINGS, format, type Dict, type Lang } from "../i18n/dict";
import type { Account, Instance, LauncherSettings } from "../../shared/types";

export type TKey = keyof Dict;

interface AppState {
  settings: LauncherSettings | null;
  accounts: Account[];
  activeAccount: Account | null;
  instances: Instance[];
  launchStatus: string;
  lang: Lang;
  t: (key: TKey, params?: Record<string, string | number>) => string;
  reloadAll: () => Promise<void>;
  notify: (text: string, error?: boolean) => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp hors contexte");
  return ctx;
}

export function useT(): AppState["t"] {
  return useApp().t;
}

export function AppProvider({ children, notify }: { children: ReactNode; notify: (t: string, e?: boolean) => void }) {
  const [settings, setSettings] = useState<LauncherSettings | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [launchStatus, setLaunchStatus] = useState("");

  const lang: Lang = settings?.language === "en" ? "en" : "fr";
  const t = useCallback(
    (key: TKey, params?: Record<string, string | number>) => format(STRINGS[lang][key] ?? key, params),
    [lang],
  );

  const reloadAll = useCallback(async () => {
    try {
      const [s, acc, inst] = await Promise.all([
        api<LauncherSettings>("settings:get"),
        api<Account[]>("accounts:list"),
        api<Instance[]>("instances:list"),
      ]);
      setSettings(s);
      setAccounts(acc);
      try {
        const active = await api<{ account: Account | null }>("accounts:get-active");
        setActiveAccount(active.account);
      } catch {
        setActiveAccount(acc[0] ?? null);
      }
      setInstances(inst);
      const l = s.language === "en" ? "en" : "fr";
      document.documentElement.dataset.theme = s.theme;
      document.documentElement.lang = l;
      document.documentElement.dataset.transparency = s.transparency === false ? "off" : "on";
      document.documentElement.style.setProperty("--accent", s.accentColor);
      document.documentElement.style.setProperty("--scale", String(s.interfaceScale / 100));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Chargement impossible.", true);
    }
  }, [notify]);

  useEffect(() => {
    void reloadAll();
    return onEvent("launch:status", (s) => setLaunchStatus((s as { message: string }).message));
  }, [reloadAll]);

  return (
    <Ctx.Provider value={{ settings, accounts, activeAccount, instances, launchStatus, lang, t, reloadAll, notify }}>
      {children}
    </Ctx.Provider>
  );
}
