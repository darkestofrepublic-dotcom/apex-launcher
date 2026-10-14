import { useEffect, useState } from "react";
import { api, onEvent } from "../lib/api";
import { useApp } from "./store";
import { IconPlus, IconChevron } from "./icons";

function WinIcon({ kind }: { kind: "min" | "max" | "restore" | "close" }) {
  if (kind === "min") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
        <path d="M2 6h8" />
      </svg>
    );
  }
  if (kind === "close") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
        <path d="M3 3l6 6M9 3 3 9" />
      </svg>
    );
  }
  if (kind === "restore") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.2}>
        <rect x="3.5" y="1.5" width="7" height="7" rx="1" />
        <path d="M8.5 3.5v-1a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
    </svg>
  );
}

/** Barre de titre personnalisée (fenêtre sans bordure) : titre à gauche, contrôles en haut à droite. */
export default function TitleBar({ pageTitle, onAccounts }: { pageTitle: string; onAccounts: () => void }) {
  const { activeAccount, t } = useApp();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    api<boolean>("window:is-maximized").then(setMaximized).catch(() => {});
    return onEvent("window:max-state", (d) => setMaximized((d as { maximized: boolean }).maximized));
  }, []);

  return (
    <header className="titlebar">
      <div className="titlebar-left">
        <span className="titlebar-title">{pageTitle}</span>
      </div>
      <div className="titlebar-center">
        <button className="account-chip nodrag" onClick={onAccounts} title={t("top.manageAccounts")}>
          <span className="avatar">
            {activeAccount?.avatarPath ? <img src={`file://${activeAccount.avatarPath}`} alt="" /> : (activeAccount ? activeAccount.displayName.slice(0, 1).toUpperCase() : "?")}
          </span>
          <span>{activeAccount ? activeAccount.displayName : t("top.noProfile")}</span>
          <span className={`pill${activeAccount?.type === "offline" ? " amber" : activeAccount ? " blue" : ""}`}>
            {activeAccount ? (activeAccount.type === "microsoft" ? "Microsoft" : t("acc.offline")) : "—"}
          </span>
          <IconChevron />
        </button>
        <button className="btn ghost small nodrag" onClick={onAccounts}><IconPlus />{t("top.addAccount")}</button>
      </div>
      <div className="win-controls nodrag">
        <button className="win-btn" title={t("win.min")} onClick={() => void api("window:minimize").catch(() => {})}>
          <WinIcon kind="min" />
        </button>
        <button className="win-btn" title={maximized ? t("win.restore") : t("win.max")} onClick={() => void api("window:maximize-toggle").then(() => api<boolean>("window:is-maximized").then(setMaximized).catch(() => {})).catch(() => {})}>
          <WinIcon kind={maximized ? "restore" : "max"} />
        </button>
        <button className="win-btn close" title={t("common.close")} onClick={() => void api("window:close").catch(() => {})}>
          <WinIcon kind="close" />
        </button>
      </div>
    </header>
  );
}
