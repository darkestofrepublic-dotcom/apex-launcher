import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Empty } from "../components/ui";
import { IconPlus, IconCheck, IconTrash, IconDownload } from "../components/icons";

interface Skin {
  id: string;
  name: string;
  fileName: string;
  path: string;
  width: number;
  height: number;
  createdAt: number;
}

interface Status {
  id: string;
  name: string;
  loader: string;
  minecraftVersion: string;
  modded: boolean;
  hasCustomSkinLoader: boolean;
  skinFiles: string[];
}

/** Tête du skin (zone 8×8 + calque chapeau), rendue en pixelisé via canvas. */
function SkinFace({ file, size = 56 }: { file: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, size, size);
      if (img.width >= 64 && img.height >= 32) {
        ctx.drawImage(img, 40, 8, 8, 8, 0, 0, size, size);
      }
    };
    img.src = `file://${file}`;
  }, [file, size]);
  return <canvas ref={ref} width={size} height={size} className="skin-preview" style={{ width: size, height: size }} />;
}

export default function Skins() {
  const { notify, reloadAll, t } = useApp();
  const [skins, setSkins] = useState<Skin[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [status, setStatus] = useState<Status[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const res = await api<{ skins: Skin[]; activeId?: string }>("skins:list");
      setSkins(res.skins);
      setActiveId(res.activeId);
      setStatus(await api<Status[]>("skins:status"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.loadFailed"), true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const upload = async () => {
    try {
      const res = await api<{ ok: boolean } | null>("skins:upload", {});
      if (res) {
        notify(t("skins.uploaded"));
        await refresh();
        await reloadAll();
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : t("skins.uploadFailed"), true);
    }
  };

  const applyAll = async () => {
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; data?: { applied: string[]; skipped: string[]; errors: string[] }; error?: string }>("skins:apply-all", {});
      if (res.data?.applied.length) notify(t("skins.applied", { n: res.data.applied.join(", ") }));
      if (res.data?.skipped.length) notify(t("skins.skipped", { n: res.data.skipped.join(", ") }));
      if (!res.ok) notify(res.error ?? t("common.opFailed"), true);
      await refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.opFailed"), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t("skins.title")}</h2>
        <div className="row">
          <button className="btn ghost" onClick={upload}><IconPlus />{t("skins.upload")}</button>
          <button className="btn" disabled={busy || !activeId} onClick={applyAll}><IconDownload />{busy ? t("common.loading") : t("skins.applyAll")}</button>
        </div>
      </div>
      <p className="muted small">{t("skins.note")}</p>

      {!skins.length ? (
        <Empty title={t("skins.empty")} hint={t("skins.emptyHint")} action={<button className="btn" onClick={upload}>{t("skins.upload")}</button>} />
      ) : (
        <div className="grid cards" style={{ marginBottom: 14 }}>
          {skins.map((s) => (
            <div key={s.id} className="card" style={activeId === s.id ? { borderColor: "var(--accent)" } : undefined}>
              <div className="row">
                <SkinFace file={s.path} size={56} />
                <div>
                  <strong>{s.name}</strong>
                  <div className="muted small">{s.width}×{s.height} PNG</div>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <img src={`file://${s.path}`} alt={s.name} className="skin-preview" style={{ width: "100%", maxHeight: 190, objectFit: "contain" }} />
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                {activeId === s.id
                  ? <span className="pill green"><IconCheck />{t("skins.active")}</span>
                  : <button className="btn small" onClick={() => void api("skins:set-active", { id: s.id }).then(() => refresh()).catch((e: Error) => notify(e.message, true))}>{t("skins.activate")}</button>}
                <button className="icon-btn" title={t("common.delete")} onClick={() => { if (confirm(t("skins.deleteConfirm", { n: s.name }))) void api("skins:remove", { id: s.id }).then(() => { void refresh(); void reloadAll(); }); }}><IconTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>{t("skins.instances")}</h3></div>
        {!status.length ? (
          <p className="muted small">{t("lib.noInstance")}</p>
        ) : (
          <table>
            <thead><tr><th>{t("common.name")}</th><th>{t("home.fVersion")}</th><th>{t("home.fLoader")}</th><th>CustomSkinLoader</th><th>Skin</th></tr></thead>
            <tbody>
              {status.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.minecraftVersion}</td>
                  <td>{s.loader}</td>
                  <td>
                    {s.modded
                      ? <span className={`pill${s.hasCustomSkinLoader ? " green" : " amber"}`}>{s.hasCustomSkinLoader ? t("skins.installed") : t("skins.missing")}</span>
                      : <span className="pill">Vanilla</span>}
                  </td>
                  <td className="mono small">{s.skinFiles.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
