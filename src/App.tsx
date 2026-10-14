import { Suspense, lazy, useEffect, useState } from "react";
import { api } from "./lib/api";
import { AppProvider } from "./components/store";
import { DownloadsProvider } from "./components/downloads";
import { useToast } from "./components/ui";
import { useApp } from "./components/store";
import { APP_VERSION } from "../shared/version";
import TitleBar from "./components/TitleBar";
import {
  IconHome, IconBox, IconBook, IconPuzzle, IconLayers, IconGlobe, IconFile,
  IconUser, IconJava, IconGear, IconX, IconUpdate, IconArchive, IconShirt, IconHelp,
} from "./components/icons";
import { CapturesLogs, BackupsHud, DownloadsPanel } from "./pages/Panels";
import logoUrl from "./assets/logo.svg";

// Pages chargées à la demande (démarrage plus rapide, paquets séparés).
const Home = lazy(() => import("./pages/Home"));
const Instances = lazy(() => import("./pages/Instances"));
const Library = lazy(() => import("./pages/Library"));
const Content = lazy(() => import("./pages/Content"));
const Modpacks = lazy(() => import("./pages/Modpacks"));
const Servers = lazy(() => import("./pages/Servers"));
const Accounts = lazy(() => import("./pages/Accounts"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const JavaPage = lazy(() => import("./pages/JavaPage"));
const Skins = lazy(() => import("./pages/Skins"));
const Support = lazy(() => import("./pages/Support"));

type Page = "accueil" | "instances" | "bibliotheque" | "modpacks" | "contenu" | "serveurs" | "captures" | "sauvegardes" | "comptes" | "skins" | "java" | "support" | "parametres";

interface UpdateState {
  available: boolean;
  latestVersion?: string;
  downloadUrl?: string;
}

function Shell() {
  const [page, setPage] = useState<Page>("accueil");
  const { settings, t } = useApp();  const [update, setUpdate] = useState<UpdateState | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  const NAV: { id: Page; label: string; icon: (p: object) => JSX.Element }[] = [
    { id: "accueil", label: t("nav.home"), icon: (p) => <IconHome {...p} /> },
    { id: "instances", label: t("nav.instances"), icon: (p) => <IconBox {...p} /> },
    { id: "bibliotheque", label: t("nav.library"), icon: (p) => <IconBook {...p} /> },
    { id: "modpacks", label: t("nav.packs"), icon: (p) => <IconLayers {...p} /> },
    { id: "contenu", label: t("nav.content"), icon: (p) => <IconPuzzle {...p} /> },
    { id: "serveurs", label: t("nav.servers"), icon: (p) => <IconGlobe {...p} /> },
    { id: "captures", label: t("nav.logs"), icon: (p) => <IconFile {...p} /> },
    { id: "sauvegardes", label: t("nav.backups"), icon: (p) => <IconArchive {...p} /> },
    { id: "comptes", label: t("nav.accounts"), icon: (p) => <IconUser {...p} /> },
    { id: "skins", label: t("nav.skins"), icon: (p) => <IconShirt {...p} /> },
    { id: "java", label: t("nav.java"), icon: (p) => <IconJava {...p} /> },
    { id: "support", label: t("nav.support"), icon: (p) => <IconHelp {...p} /> },
    { id: "parametres", label: t("nav.settings"), icon: (p) => <IconGear {...p} /> },
  ];

  const pageTitle = NAV.find((n) => n.id === page)?.label ?? "Apex Launcher";

  useEffect(() => {
    if (!settings) return;
    if (!settings.checkUpdatesOnStartup) return;
    let cancelled = false;
    api<{ ok: boolean; data?: UpdateState; error?: string }>("updates:check")
      .then((res) => {
        if (!cancelled && res.ok && res.data?.available) setUpdate(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [settings]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><img src={logoUrl} alt="Apex Launcher" /></div>
          <div className="brand-text">
            <strong>Apex Launcher</strong>
            <small>ApexDevlabs</small>
          </div>
        </div>
        <div className="side-label">{t("nav.menu")}</div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-btn${page === n.id ? " active" : ""}`} onClick={() => setPage(n.id)}>
            <n.icon />
            <span className="lbl">{n.label}</span>
          </button>
        ))}
        <div className="side-foot">v{APP_VERSION}</div>
      </aside>
      <div className="main">
        <TitleBar pageTitle={pageTitle} onAccounts={() => setPage("comptes")} />
        <div className="content">
          {update && !updateDismissed && (
            <div className="update-banner">
              <IconUpdate />
              <span style={{ flex: 1 }}>{t("upd.banner", { v: update.latestVersion ?? "" })}</span>
              <button className="btn small" onClick={() => setPage("parametres")}>{t("upd.view")}</button>
              <button className="icon-btn" onClick={() => setUpdateDismissed(true)} title={t("upd.dismiss")}><IconX /></button>
            </div>
          )}
          <DownloadsPanel />
          <Suspense fallback={<p className="muted">{t("common.loading")}</p>}>
            {page === "accueil" && <Home />}
            {page === "instances" && <Instances />}
            {page === "bibliotheque" && <Library />}
            {page === "modpacks" && <Modpacks />}
            {page === "contenu" && <Content />}
            {page === "serveurs" && <Servers />}
            {page === "captures" && <CapturesLogs />}
            {page === "sauvegardes" && <BackupsHud />}
            {page === "comptes" && <Accounts />}
            {page === "skins" && <Skins />}
            {page === "java" && <JavaPage />}
            {page === "support" && <Support />}
            {page === "parametres" && <SettingsPage />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { push, view } = useToast();
  return (
    <AppProvider notify={push}>
      <DownloadsProvider>
        <Shell />
      </DownloadsProvider>
      {view}
    </AppProvider>
  );
}
