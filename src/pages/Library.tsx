import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Empty } from "../components/ui";
import Select from "../components/Select";
import { fetchModrinthCovers } from "../lib/gallery";
import { IconFolder, IconTrash, IconSearch, IconDownload, IconX } from "../components/icons";
import type { InstalledMod } from "../../shared/types";

interface OnlineHit {
  project_id: string;
  title: string;
  description: string;
  author: string;
  icon_url?: string;
  downloads: number;
}

type Tab = "mods" | "shaders";

export default function Library() {
  const { instances, notify, t } = useApp();
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("mods");
  const [items, setItems] = useState<InstalledMod[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [bQuery, setBQuery] = useState("");
  const [bResults, setBResults] = useState<OnlineHit[]>([]);
  const [bBusy, setBBusy] = useState(false);
  const [covers, setCovers] = useState<Record<string, string>>({});

  const instance = instances.find((i) => i.id === instanceId) ?? instances[0];
  const ch = tab === "mods" ? "mods" : "shaders";

  const refresh = async (dir?: string) => {
    const d = dir ?? instance?.directory;
    if (!d) return;
    try {
      if (tab === "mods") {
        const res = await api<{ mods: InstalledMod[]; warnings: string[] }>("mods:list", { instanceDir: d });
        setItems(res.mods);
        setWarnings(res.warnings);
      } else {
        setItems(await api<InstalledMod[]>("shaders:list", { instanceDir: d }));
        setWarnings([]);
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : t("lib.readFailed"), true);
    }
  };

  useEffect(() => {
    if (!instanceId && instances[0]) setInstanceId(instances[0].id);
    if (instance) void refresh(instance.directory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId, instances.length, tab]);

  // Suggestions automatiques à l'ouverture du navigateur (populaires compatibles).
  useEffect(() => {
    if (showBrowser && !bResults.length) void bSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBrowser, tab]);

  if (!instance) return <Empty title={t("lib.noInstance")} hint={t("lib.noInstanceHint")} />;

  const visible = items.filter((m) => m.fileName.toLowerCase().includes(search.toLowerCase()));

  const bSearch = async () => {
    if (!instance) return;
    setBBusy(true);
    try {
      const hits = await api<OnlineHit[]>("modrinth:search", {
        query: bQuery,
        projectType: tab === "mods" ? "mod" : "shader",
        gameVersion: instance.minecraftVersion,
        loader: instance.loader !== "vanilla" ? instance.loader : undefined,
      });
      setBResults(hits);
      void fetchModrinthCovers(hits.map((h) => h.project_id)).then((c) =>
        setCovers((prev) => ({ ...prev, ...c })),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : t("content.searchFailed"), true);
    } finally {
      setBBusy(false);
    }
  };

  const bInstall = async (projectId: string, title: string) => {
    if (!instance) return;
    try {
      await api("modrinth:install", {
        projectId,
        instanceDir: instance.directory,
        target: tab === "mods" ? "mods" : "shaderpacks",
        gameVersion: instance.minecraftVersion,
        loader: instance.loader,
      });
      notify(t("content.queued", { t: title, i: instance.name }));
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("content.installFailed"), true);
    }
  };

  const toggle = (fileName: string, enabled: boolean) =>
    api(`${ch}:toggle` as "mods:toggle", { instanceDir: instance.directory, fileName, enabled })
      .then(() => refresh())
      .catch((e: Error) => notify(e.message, true));

  const remove = (fileName: string) => {
    if (!confirm(t(tab === "mods" ? "lib.deleteConfirm" : "lib.deleteShaderConfirm", { f: fileName }))) return;
    void api(`${ch}:remove` as "mods:remove", { instanceDir: instance.directory, fileName })
      .then(() => refresh())
      .catch((e: Error) => notify(e.message, true));
  };

  const openFolder = () =>
    void api(`${ch}:open-folder` as "mods:open-folder", { instanceDir: instance.directory }).catch((e: Error) => notify(e.message, true));

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t("lib.title", { name: instance.name })}</h2>
        <div className="row">
          <Select
            value={instance.id}
            onChange={setInstanceId}
            width={240}
            searchable
            options={instances.map((i) => ({ value: i.id, label: i.name, hint: `${i.minecraftVersion} • ${i.loader}` }))}
          />
          <button className="btn ghost small" onClick={openFolder}><IconFolder />{tab === "mods" ? t("lib.openMods") : t("lib.openShaders")}</button>
        </div>
      </div>

      <div className="tabs">
        <button className={`btn small${tab === "mods" ? "" : " ghost"}`} onClick={() => { setTab("mods"); setBResults([]); }}>{t("lib.tMods")}</button>
        <button className={`btn small${tab === "shaders" ? "" : " ghost"}`} onClick={() => { setTab("shaders"); setBResults([]); }}>{t("lib.tShaders")}</button>
      </div>

      {warnings.map((w, i) => (
        <p key={i} className="small" style={{ color: "var(--amber)" }}>{w}</p>
      ))}

      <div className="row" style={{ marginBottom: 12 }}>
        <input style={{ maxWidth: 320 }} placeholder={t("lib.searchPh")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="muted small">{t(tab === "mods" ? "lib.count" : "lib.countShaders", { n: visible.length })}</span>
        <span style={{ flex: 1 }} />
        <button className="btn small" onClick={() => setShowBrowser((v) => !v)}>
          {showBrowser ? <IconX /> : <IconSearch />}{showBrowser ? t("lib.hideBrowser") : t("lib.browse")}
        </button>
      </div>

      {showBrowser && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head"><h3>{t("lib.browse")} — {t("lib.compatible", { v: instance.minecraftVersion, l: instance.loader })}</h3></div>
          <div className="row" style={{ marginBottom: 12 }}>
            <input style={{ maxWidth: 340 }} placeholder={t("lib.browsePh")} value={bQuery} onChange={(e) => setBQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void bSearch(); }} />
            <button className="btn small" disabled={bBusy} onClick={() => void bSearch()}><IconSearch />{bBusy ? t("content.searching") : t("content.searchBtn")}</button>
          </div>
          {!bQuery.trim() && bResults.length > 0 && <h3 className="section-title">{t("common.popular")}</h3>}
          <div className="grid cards">
            {bResults.map((r) => (
              <div key={r.project_id} className="card">
                {covers[r.project_id] && (
                  <div className="cover"><img src={covers[r.project_id]} alt="" loading="lazy" /></div>
                )}
                <div className="row">
                  {r.icon_url && <img src={r.icon_url} alt="" width={34} height={34} style={{ borderRadius: 8 }} />}
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted small">{t("content.by", { a: r.author })}</div>
                  </div>
                </div>
                <p className="muted small">{r.description}</p>
                <button className="btn small" onClick={() => void bInstall(r.project_id, r.title)}><IconDownload />{t("content.install")}</button>
              </div>
            ))}
          </div>
          {!bResults.length && !bBusy && <p className="muted small">{t("content.discoverHint")}</p>}
        </div>
      )}

      {!visible.length ? (
        <Empty title={tab === "mods" ? t("lib.empty") : t("lib.emptyShaders")} hint={tab === "mods" ? t("lib.emptyHint") : t("lib.emptyShadersHint")} />
      ) : (
        <div className="card" style={{ padding: "6px 14px" }}>
          <table>
            <thead>
              <tr><th>{t("lib.file")}</th><th>{t("lib.size")}</th><th>{t("common.state")}</th><th>{t("common.actions")}</th></tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.fileName}>
                  <td className="mono">{m.fileName}</td>
                  <td>{(m.size / 1024).toFixed(0)} Ko</td>
                  <td>
                    <span className={`pill${m.enabled ? " green" : ""}`}>{m.enabled ? t("lib.enabled") : t("lib.disabled")}</span>
                  </td>
                  <td>
                    <div className="row">
                      <button className="btn ghost small" onClick={() => void toggle(m.fileName, !m.enabled)}>
                        {m.enabled ? t("common.disable") : t("common.enable")}
                      </button>
                      <button className="icon-btn" title={t("common.delete")} onClick={() => remove(m.fileName)}>
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small" style={{ marginTop: 12 }}>{t("lib.note")}</p>
    </div>
  );
}
