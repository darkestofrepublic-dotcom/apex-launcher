import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Modal, Field, Empty } from "../components/ui";
import Select from "../components/Select";
import { IconPlay, IconPlus, IconAlert } from "../components/icons";
import { APP_VERSION } from "../../shared/version";
import type { Instance, McVersionInfo, LoaderType } from "../../shared/types";

const LOADERS: LoaderType[] = ["vanilla", "fabric", "forge", "neoforge", "quilt"];

export default function Home() {
  const { instances, activeAccount, settings, launchStatus, notify, reloadAll, t } = useApp();
  const [versions, setVersions] = useState<McVersionInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [playing, setPlaying] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api<McVersionInfo[]>("versions:list").then(setVersions).catch(() => setVersions([]));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedId(settings?.selectedInstanceId ?? instances[0]?.id ?? "");
    }
  }, [instances, settings, selectedId]);

  const selected: Instance | undefined = instances.find((i) => i.id === selectedId) ?? instances[0];

  const play = async () => {
    if (!selected) {
      notify(t("home.needInstance"), true);
      return;
    }
    if (!activeAccount) {
      notify(t("home.needAccount"), true);
      return;
    }
    setPlaying(true);
    try {
      await api("launch:play", { instanceId: selected.id });
      await reloadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("home.launchFailed"), true);
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div>
      <div className="hero">
        <div>
          <div className="overline">{t("home.overline")}</div>
          <h1>{t("home.ready")}</h1>
          <p>
            {selected
              ? t("home.meta", {
                  v: selected.minecraftVersion,
                  loader: selected.loader,
                  ram: selected.memoryMaxMb,
                  account: activeAccount ? activeAccount.displayName : t("home.noAccount"),
                })
              : t("home.noInstanceHint")}
          </p>
        </div>
        <div className="spacer" />
        {selected && (
          <button className="btn play-btn" disabled={playing} onClick={play}>
            <IconPlay />{playing ? t("home.launching") : t("home.play")}
          </button>
        )}
      </div>
      {launchStatus && (
        <p className="muted small" style={{ margin: "0 0 14px" }}>{launchStatus}</p>
      )}

      <div className="grid two">
        <div className="card">
          <div className="card-head">
            <h3>{t("home.quick")}</h3>
            <button className="btn ghost small" onClick={() => setShowCreate(true)}><IconPlus />{t("home.newInstance")}</button>
          </div>
          {!instances.length ? (
            <Empty title={t("home.empty")} hint={t("home.emptyHint")} action={<button className="btn" onClick={() => setShowCreate(true)}>{t("home.createTitle")}</button>} />
          ) : (
            <Select
              label={t("home.instance")}
              value={selected?.id ?? ""}
              onChange={setSelectedId}
              options={instances.map((i) => ({ value: i.id, label: i.name, hint: `${i.minecraftVersion} • ${i.loader}` }))}
              searchable
            />
          )}
        </div>
        <div className="card">
          <div className="card-head"><h3>{t("home.activity")}</h3></div>
          {[t("home.activity1"), t("home.activity2"), t("home.activity3")].map((a, i) => (
            <p key={i} className="muted small" style={{ margin: "8px 0" }}>— {a}</p>
          ))}
          <h3 className="section-title">{t("home.updates")}</h3>
          <p className="muted small">{t("home.updateNote", { v: APP_VERSION })}</p>
          <p className="muted small">{t("home.stableCount", { n: versions.filter((v) => v.type === "release").length })}</p>
        </div>
      </div>

      {showCreate && <CreateInstance versions={versions} onClose={() => { setShowCreate(false); void reloadAll(); }} />}
    </div>
  );
}

export function CreateInstance({ versions, onClose }: { versions: McVersionInfo[]; onClose: () => void }) {
  const { notify, t } = useApp();
  const [name, setName] = useState("");
  const [version, setVersion] = useState(versions.find((v) => v.type === "release")?.id ?? "");
  const [loader, setLoader] = useState<LoaderType>("vanilla");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [loaderChoices, setLoaderChoices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loader === "vanilla" || !version) {
      setLoaderChoices([]);
      return;
    }
    api<string[]>("loaders:versions", { loader, minecraftVersion: version })
      .then((list) => {
        setLoaderChoices(list);
        setLoaderVersion(list[0] ?? "");
      })
      .catch((e) => {
        setLoaderChoices([]);
        notify(e instanceof Error ? e.message : t("common.opFailed"), true);
      });
  }, [loader, version, notify, t]);

  const submit = async () => {
    setBusy(true);
    try {
      await api("instances:create", { name, minecraftVersion: version, loader, loaderVersion: loaderVersion || undefined });
      notify(t("home.created", { name }));
      onClose();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.createFailed"), true);
    } finally {
      setBusy(false);
    }
  };

  const loaderLabel = (l: LoaderType) => (l === "vanilla" ? t("home.loaderVanilla") : l === "neoforge" ? "NeoForge" : l[0].toUpperCase() + l.slice(1));
  const releases = versions.filter((v) => v.type === "release").slice(0, 60);
  const snapshots = versions.filter((v) => v.type === "snapshot").slice(0, 20);

  return (
    <Modal title={t("home.createTitle")} onClose={onClose}>
      <div className="grid">
        <Field label={t("home.fName")}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("home.fNamePh")} />
        </Field>
        <Select
          label={t("home.fVersion")}
          value={version}
          onChange={setVersion}
          searchable
          options={[
            ...releases.map((v) => ({ value: v.id, label: v.id, hint: v.installed ? "✓" : undefined })),
            ...snapshots.map((v) => ({ value: v.id, label: v.id })),
          ]}
        />
        <Select
          label={t("home.fLoader")}
          value={loader}
          onChange={(v) => setLoader(v as LoaderType)}
          options={LOADERS.map((l) => ({ value: l, label: loaderLabel(l) }))}
        />
        {loader !== "vanilla" && (
          <Select
            label={t("home.fLoaderVersion")}
            value={loaderVersion}
            onChange={setLoaderVersion}
            searchable
            options={loaderChoices.map((c) => ({ value: c, label: c }))}
          />
        )}
        {(loader === "forge" || loader === "neoforge") && (
          <p className="muted small"><IconAlert /> {t("home.forgeNote")}</p>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn" disabled={busy || !name.trim() || !version} onClick={submit}>{busy ? t("common.loading") : t("common.create")}</button>
        </div>
      </div>
    </Modal>
  );
}
