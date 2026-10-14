import { useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Field } from "../components/ui";
import Select from "../components/Select";
import { Confirm, Switch } from "../components/ui";
import { IconDownload, IconRefresh, IconUpdate, IconMoon, IconSun } from "../components/icons";
import { APP_VERSION } from "../../shared/version";

interface UpdateData {
  available: boolean;
  latestVersion?: string;
  downloadUrl?: string;
  notes?: string;
}

export default function SettingsPage() {
  const { settings, reloadAll, notify, t } = useApp();
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateData | null>(null);
  const [feedError, setFeedError] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);

  if (!settings) return <p className="muted">{t("common.loading")}</p>;

  const set = async (patch: Partial<typeof settings>) => {
    setSaving(true);
    try {
      await api("settings:update", patch);
      await reloadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.saveFailed"), true);
    } finally {
      setSaving(false);
    }
  };

  const check = async () => {
    setChecking(true);
    setFeedError(false);
    try {
      const res = await api<{ ok: boolean; data?: UpdateData; error?: string }>("updates:check");
      if (res.ok && res.data) {
        setUpdate(res.data);
        if (!res.data.available) notify(t("set.upToDate"));
      } else {
        setFeedError(true);
        notify(t("set.feedError"), true);
      }
    } catch (e) {
      setFeedError(true);
      notify(e instanceof Error ? e.message : t("set.feedError"), true);
    } finally {
      setChecking(false);
    }
  };

  const download = async () => {
    if (!update?.downloadUrl) return;
    try {
      await api("updates:download", { url: update.downloadUrl });
      notify(t("set.updateQueued"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.opFailed"), true);
    }
  };

  const apply = async () => {
    if (!update?.downloadUrl) return;
    setApplying(true);
    try {
      await api("updates:download-and-apply", { url: update.downloadUrl });
      notify(t("set.applyStarted"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.opFailed"), true);
      setApplying(false);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 4px", fontSize: 19 }}>{t("set.title")}</h2>

      <h3 className="section-title">{t("set.language")}</h3>
      <div className="card">
        <div className="field-row">
          <Select
            label={t("set.language")}
            value={settings.language}
            onChange={(v) => void set({ language: v as "fr" | "en" })}
            options={[
              { value: "fr", label: t("set.french") },
              { value: "en", label: t("set.english") },
            ]}
          />
        </div>
        <p className="muted small">{t("set.languageNote")}</p>
      </div>

      <h3 className="section-title">{t("set.updates")}</h3>
      <div className="card">
        <p style={{ margin: "0 0 10px" }}>{t("set.current", { v: APP_VERSION })}</p>
        <div className="row">
          <button className="btn" disabled={checking} onClick={check}><IconRefresh />{checking ? t("set.checking") : t("set.check")}</button>
          <label className="row small">{t("set.onStartup")} <input type="checkbox" style={{ width: 16 }} checked={settings.checkUpdatesOnStartup ?? true} onChange={(e) => void set({ checkUpdatesOnStartup: e.target.checked })} /></label>
        </div>
        {update?.available && (
          <div className="row" style={{ marginTop: 12 }}>
            <span className="pill blue"><IconUpdate />{t("set.available", { v: update.latestVersion ?? "" })}</span>
            <button className="btn small" onClick={download}><IconDownload />{t("set.downloadUpdate")}</button>
            {update.downloadUrl && (
              <button className="btn small" disabled={applying} onClick={() => setConfirmApply(true)}>
                <IconUpdate />{applying ? t("common.loading") : t("set.applyUpdate")}
              </button>
            )}
          </div>
        )}
        {confirmApply && (
          <Confirm
            text={t("set.applyConfirm")}
            okLabel={t("set.applyUpdate")}
            onCancel={() => setConfirmApply(false)}
            onOk={() => { setConfirmApply(false); void apply(); }}
          />
        )}
        {feedError && <p className="small" style={{ color: "var(--amber)" }}>{t("set.feedError")}</p>}
        <div className="field-row" style={{ marginTop: 12 }}>
          <Field label={t("set.feed")}>
            <input value={settings.updateFeedUrl ?? ""} onChange={(e) => void set({ updateFeedUrl: e.target.value })} placeholder="https://…" />
          </Field>
        </div>
      </div>

      <h3 className="section-title">{t("set.appearance")}</h3>
      <div className="card">
        <div className="grid" style={{ gap: 14 }}>
          <div className="switch-row">
            <Switch
              checked={settings.theme === "light"}
              onChange={(v) => void set({ theme: v ? "light" : "dark" })}
              label={t("set.theme")}
              iconOn={<IconSun />}
              iconOff={<IconMoon />}
            />
            <span className="switch-label">{t("set.theme")} — {settings.theme === "light" ? t("set.light") : t("set.dark")}</span>
          </div>
          <div className="switch-row">
            <Switch
              checked={settings.transparency !== false}
              onChange={(v) => void set({ transparency: v })}
              label={t("set.transparency")}
            />
            <span className="switch-label">{t("set.transparency")}</span>
          </div>
          <p className="muted small" style={{ margin: 0 }}>{t("set.transparencyHint")}</p>
        </div>
        <div className="field-row" style={{ marginTop: 12 }}>
          <Field label={t("set.accent")}>
            <input type="color" value={settings.accentColor} onChange={(e) => void set({ accentColor: e.target.value })} />
          </Field>
          <Field label={t("set.scale")}>
            <input type="number" min={75} max={150} value={settings.interfaceScale} onChange={(e) => void set({ interfaceScale: Number(e.target.value) })} />
          </Field>
          <label className="row small">{t("set.animations")} <input type="checkbox" style={{ width: 16 }} checked={settings.animations} onChange={(e) => void set({ animations: e.target.checked })} /></label>
        </div>
      </div>

      <h3 className="section-title">{t("set.game")}</h3>
      <div className="card">
        <div className="field-row">
          <Field label={t("inst.fRamMin")}><input type="number" value={settings.defaultMemoryMinMb} onChange={(e) => void set({ defaultMemoryMinMb: Number(e.target.value) })} /></Field>
          <Field label={t("inst.fRamMax")}><input type="number" value={settings.defaultMemoryMaxMb} onChange={(e) => void set({ defaultMemoryMaxMb: Number(e.target.value) })} /></Field>
          <Field label={t("set.winW")}><input type="number" value={settings.defaultWidth} onChange={(e) => void set({ defaultWidth: Number(e.target.value) })} /></Field>
          <Field label={t("set.winH")}><input type="number" value={settings.defaultHeight} onChange={(e) => void set({ defaultHeight: Number(e.target.value) })} /></Field>
        </div>
        <div className="field-row" style={{ marginTop: 10 }}>
          <Field label={t("set.jvm")}><input value={settings.defaultJvmArgs ?? ""} onChange={(e) => void set({ defaultJvmArgs: e.target.value })} placeholder={t("set.jvmPh")} /></Field>
          <label className="row small">{t("set.fullscreen")} <input type="checkbox" style={{ width: 16 }} checked={settings.defaultFullscreen} onChange={(e) => void set({ defaultFullscreen: e.target.checked })} /></label>
        </div>
        <p className="muted small">{t("set.ramNote")}</p>
      </div>

      <h3 className="section-title">{t("set.downloads")}</h3>
      <div className="card">
        <div className="field-row">
          <Field label={t("set.concurrent")}><input type="number" min={1} max={8} value={settings.maxConcurrentDownloads} onChange={(e) => void set({ maxConcurrentDownloads: Number(e.target.value) })} /></Field>
          <Field label={t("set.gameDir")}><input value={settings.gameDirectory} onChange={(e) => void set({ gameDirectory: e.target.value })} /></Field>
          <Field label={t("set.backupDir")}><input value={settings.backupDirectory} onChange={(e) => void set({ backupDirectory: e.target.value })} /></Field>
          <label className="row small">{t("set.resume")} <input type="checkbox" style={{ width: 16 }} checked={settings.resumeDownloads} onChange={(e) => void set({ resumeDownloads: e.target.checked })} /></label>
        </div>
      </div>

      <h3 className="section-title">{t("set.accounts")}</h3>
      <div className="card">
        <div className="field-row">
          <Field label={t("set.msId")}>
            <input type="password" value={settings.microsoftClientId ?? ""} onChange={(e) => void set({ microsoftClientId: e.target.value })} placeholder={t("set.msIdPh")} />
          </Field>
          <Field label={t("set.cfKey")}>
            <input type="password" value={settings.curseforgeApiKey ?? ""} onChange={(e) => void set({ curseforgeApiKey: e.target.value })} placeholder={t("set.cfKeyPh")} />
          </Field>
        </div>
        <p className="muted small">{t("set.secretsNote")}</p>
      </div>

      <h3 className="section-title">{t("set.privacy")}</h3>
      <div className="card">
        <label className="row small">{t("set.diagnostics")} <input type="checkbox" style={{ width: 16 }} checked={settings.diagnosticsEnabled} onChange={(e) => void set({ diagnosticsEnabled: e.target.checked })} /></label>
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn ghost small" onClick={() => void api("settings:export", {}).then(() => notify(t("set.exported"))).catch((e: Error) => notify(e.message, true))}><IconDownload />{t("set.export")}</button>
        </div>
      </div>

      {saving && <p className="muted small">{t("set.saving")}</p>}
    </div>
  );
}
