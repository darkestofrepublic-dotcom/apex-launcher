import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { useDownloads } from "../components/downloads";
import { Progress } from "../components/ui";
import Select from "../components/Select";
import { IconRefresh, IconCopy, IconDownload, IconTrash, IconFolder } from "../components/icons";
import type { BackupEntry, DownloadItem, HudModule, LogEntry } from "../../shared/types";

export function DownloadsPanel() {
  const { notify, t, lang } = useApp();
  const downloads = useDownloads();
  if (!downloads.length) return null;
  const unit = lang === "en" ? "MB" : "Mo";
  const fmtSpeed = (bps?: number) => (!bps ? "—" : bps > 1048576 ? `${(bps / 1048576).toFixed(1)} ${unit}/s` : `${Math.round(bps / 1024)} Ko/s`);
  const fmtEta = (s?: number) => (!s ? "" : ` • ${t("dl.remaining", { s })}`);
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head"><h3>{t("dl.title", { n: downloads.length })}</h3></div>
      {downloads.slice(-6).map((d: DownloadItem) => (
        <div key={d.id} style={{ marginBottom: 10 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small">{d.label} <span className="muted">— {d.status}{d.speedBps ? ` • ${fmtSpeed(d.speedBps)}` : ""}{fmtEta(d.etaSeconds)}</span></span>
            <div className="row">
              {d.status === "echec" && <button className="btn ghost small" onClick={() => void api("downloads:retry", { id: d.id }).catch((e: Error) => notify(e.message, true))}>{t("common.retry")}</button>}
              {["attente", "cours"].includes(d.status) && <button className="btn ghost small" onClick={() => void api("downloads:cancel", { id: d.id })}>{t("common.cancel")}</button>}
            </div>
          </div>
          <Progress value={d.downloadedBytes} max={d.expectedSize} />
          {d.error && <div className="small" style={{ color: "var(--red)" }}>{d.error}</div>}
        </div>
      ))}
    </div>
  );
}

export function CapturesLogs() {
  const { instances, notify, t, lang } = useApp();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [output, setOutput] = useState<string[]>([]);
  const [lastExit, setLastExit] = useState<{ code: number | null; at: number } | null>(null);
  const [filter, setFilter] = useState("");

  const refresh = async () => {
    try {
      setLogs(await api<LogEntry[]>("logs:list"));
      const game = await api<{ output: string[]; lastExit: { code: number | null; at: number } | null }>("logs:game-output");
      setOutput(game.output);
      setLastExit(game.lastExit);
    } catch (e) {
      notify(e instanceof Error ? e.message : t("logs.readFailed"), true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const locale = lang === "en" ? "en-US" : "fr-FR";
  const visible = logs.filter((l) => !filter || l.message.toLowerCase().includes(filter.toLowerCase()) || l.source.includes(filter));

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{t("logs.title")}</h2>
      <div className="grid two" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="card-head"><h3>{t("logs.shots")}</h3></div>
          {instances.length ? (
            instances.map((i) => (
              <div key={i.id} className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <span className="small">{i.name}</span>
                <button className="btn ghost small" onClick={() => void api("system:open-path", { target: `${i.directory}/screenshots` }).catch((e: Error) => notify(e.message, true))}><IconFolder />{t("common.open")}</button>
              </div>
            ))
          ) : (
            <p className="muted small">{t("logs.noInstance")}</p>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h3>{t("logs.lastOutput")}</h3></div>
          {lastExit && <p className="muted small">{t("logs.lastExit", { c: lastExit.code ?? "—", d: new Date(lastExit.at).toLocaleString(locale) })}</p>}
          <div className="logbox">{output.length ? output.slice(-60).join("\n") : t("logs.noOutput")}</div>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <h3>{t("logs.launcher")}</h3>
          <div className="row">
            <input style={{ width: 200 }} placeholder={t("logs.filterPh")} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <button className="icon-btn" title={t("common.refresh")} onClick={() => void refresh()}><IconRefresh /></button>
            <button className="btn ghost small" onClick={() => {
              const text = visible.map((l) => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`).join("\n");
              void navigator.clipboard.writeText(text).then(() => notify(t("logs.copied")));
            }}><IconCopy />{t("logs.copy")}</button>
            <button className="btn ghost small" onClick={() => void api("logs:export-diagnostic", {}).then(() => notify(t("logs.exported"))).catch((e: Error) => notify(e.message, true))}><IconDownload />{t("logs.export")}</button>
          </div>
        </div>
        <div className="logbox">{visible.length ? visible.slice(-200).map((l) => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`).join("\n") : t("logs.none")}</div>
      </div>
    </div>
  );
}

export function BackupsHud() {
  const { instances, notify, t, lang } = useApp();
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [hud, setHud] = useState<HudModule[]>([]);
  const [name, setName] = useState("");
  const [src, setSrc] = useState("");

  const refresh = async () => {
    try {
      setBackups(await api<BackupEntry[]>("backups:list"));
      setHud(await api<HudModule[]>("hud:list"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.loadFailed"), true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const locale = lang === "en" ? "en-US" : "fr-FR";
  const memUnit = lang === "en" ? "MB" : "Mo";
  const fmtSize = (b: number) => (b / 1024 / 1024).toFixed(1);

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{t("bk.title")}</h2>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>{t("bk.create")}</h3></div>
        <div className="row">
          <input style={{ maxWidth: 220 }} placeholder={t("bk.namePh")} value={name} onChange={(e) => setName(e.target.value)} />
          <Select
            value={src}
            onChange={setSrc}
            width={320}
            placeholder={t("bk.choose")}
            options={instances.flatMap((i) => [
              { value: `${i.directory}/saves`, label: `${i.name} ${t("bk.saves")}` },
              { value: `${i.directory}/config`, label: `${i.name} ${t("bk.config")}` },
              { value: i.directory, label: `${i.name} ${t("bk.full")}` },
            ])}
          />
          <button className="btn small" onClick={() => {
            if (!name.trim() || !src) {
              notify(t("bk.needBoth"), true);
              return;
            }
            void api("backups:create", { kind: "monde", name, sourceDir: src }).then(() => { notify(t("inst.backupDone")); void refresh(); }).catch((e: Error) => notify(e.message, true));
          }}>{t("bk.saveBtn")}</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>{t("bk.list", { n: backups.length })}</h3></div>
        {!backups.length ? <p className="muted small">{t("bk.none")}</p> : backups.map((b) => (
          <div key={b.id} className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="small">{b.name} <span className="muted">• {fmtSize(b.size)} {memUnit} • {new Date(b.createdAt).toLocaleString(locale)}</span></span>
            <div className="row">
              <button className="btn ghost small" onClick={() => {
                const dest = prompt(t("bk.destPrompt"), "");
                if (!dest) return;
                const ok = confirm(t("bk.overwrite"));
                void api("backups:restore", { id: b.id, destDir: dest, confirmOverwrite: ok }).then(() => notify(t("bk.restored"))).catch((e: Error) => notify(e.message, true));
              }}>{t("bk.restore")}</button>
              <button className="icon-btn" title={t("common.delete")} onClick={() => { if (confirm(t("bk.deleteConfirm", { n: b.name }))) void api("backups:remove", { id: b.id }).then(() => refresh()); }}><IconTrash /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-head"><h3>{t("bk.hud")}</h3></div>
        <p className="muted small">{t("bk.hudNote")}</p>
        {hud.map((m) => (
          <div key={m.id} className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="small">{m.name} <span className="muted">— {m.available ? m.description : t("bk.unavailable", { r: m.missingDependency ?? "" })}</span></span>
            <button className="btn ghost small" disabled={!m.available} onClick={() =>
              void api("hud:update", { id: m.id, patch: { enabled: !m.enabled } })
                .then(() => refresh())
                .catch((e: Error) => notify(e.message, true))
            }>
              {m.enabled ? t("common.disable") : t("common.enable")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
