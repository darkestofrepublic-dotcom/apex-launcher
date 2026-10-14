import { useMemo, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Modal, Field, Empty } from "../components/ui";
import Select from "../components/Select";
import { IconDots, IconFolder, IconEdit, IconCopy, IconDownload, IconArchive, IconTrash } from "../components/icons";
import type { Instance } from "../../shared/types";

export default function Instances() {
  const { instances, reloadAll, notify, t, lang } = useApp();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"nom" | "recent" | "version">("nom");
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [deleting, setDeleting] = useState<Instance | null>(null);
  const [deleteFiles, setDeleteFiles] = useState(false);

  const filtered = useMemo(() => {
    const list = instances.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    if (sort === "nom") list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "recent") list.sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0));
    if (sort === "version") list.sort((a, b) => b.minecraftVersion.localeCompare(a.minecraftVersion));
    return list;
  }, [instances, search, sort]);

  const act = async (fn: () => Promise<unknown>, okMsg: string) => {
    try {
      await fn();
      notify(okMsg);
      await reloadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.opFailed"), true);
    } finally {
      setMenuFor(null);
    }
  };

  const dateFmt = (ts: number) => new Date(ts).toLocaleDateString(lang === "en" ? "en-US" : "fr-FR");

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t("inst.title", { n: instances.length })}</h2>
        <div className="row">
          <input style={{ width: 220 }} placeholder={t("inst.searchPh")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select
            value={sort}
            onChange={(v) => setSort(v as typeof sort)}
            width={170}
            options={[
              { value: "nom", label: t("inst.sortName") },
              { value: "recent", label: t("inst.sortRecent") },
              { value: "version", label: t("inst.sortVersion") },
            ]}
          />
        </div>
      </div>

      {!filtered.length ? (
        <Empty title={t("inst.none")} hint={t("inst.noneHint")} />
      ) : (
        <div className="grid cards">
          {filtered.map((inst) => (
            <div key={inst.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{inst.name}</strong>
                <div className="menu-dots">
                  <button className="icon-btn" onClick={() => setMenuFor(menuFor === inst.id ? null : inst.id)}><IconDots /></button>
                  {menuFor === inst.id && (
                    <div className="menu-pop">
                      <button onClick={() => void act(() => api("instances:open-folder", { id: inst.id }), t("inst.folderOpened"))}><IconFolder />{t("inst.openFolder")}</button>
                      <button onClick={() => { setEditing(inst); setMenuFor(null); }}><IconEdit />{t("inst.editSettings")}</button>
                      <button onClick={() => void act(() => api("instances:duplicate", { id: inst.id }), t("inst.duplicated"))}><IconCopy />{t("inst.duplicate")}</button>
                      <button onClick={() => void act(() => api("instances:export", { id: inst.id }), t("inst.exportRequested"))}><IconDownload />{t("inst.export")}</button>
                      <button onClick={() => void act(() => api("backups:create", { kind: "instance", name: inst.name, sourceDir: inst.directory }), t("inst.backupDone"))}><IconArchive />{t("inst.backup")}</button>
                      <button className="danger" onClick={() => { setDeleting(inst); setMenuFor(null); }}><IconTrash />{t("inst.deleteMenu")}</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="row" style={{ margin: "10px 0 4px" }}>
                <span className="pill blue">{inst.minecraftVersion}</span>
                <span className="pill">{inst.loader}</span>
                <span className="pill">{inst.memoryMaxMb} {lang === "en" ? "MB" : "Mo"}</span>
              </div>
              <p className="muted small" style={{ margin: "6px 0" }}>
                {t("inst.launches", { n: inst.playCount })}
                {inst.lastPlayedAt ? ` • ${t("inst.lastPlayed", { d: dateFmt(inst.lastPlayedAt) })}` : ` • ${t("inst.neverPlayed")}`}
              </p>
              {inst.description && <p className="muted small">{inst.description}</p>}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditInstance instance={editing} onClose={() => { setEditing(null); void reloadAll(); }} />
      )}
      {deleting && (
        <Modal title={t("inst.deleteTitle", { name: deleting.name })} onClose={() => setDeleting(null)}>
          <p>{t("inst.deleteText")}</p>
          <label className="row" style={{ margin: "12px 0" }}>
            <input type="checkbox" style={{ width: 18 }} checked={deleteFiles} onChange={(e) => setDeleteFiles(e.target.checked)} />
            {t("inst.deleteFiles")}
          </label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn ghost" onClick={() => setDeleting(null)}>{t("common.cancel")}</button>
            <button className="btn danger solid" onClick={() => void act(() => api("instances:remove", { id: deleting.id, deleteFiles }), t("inst.deleted"))}>{t("common.delete")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function EditInstance({ instance, onClose }: { instance: Instance; onClose: () => void }) {
  const { notify, t } = useApp();
  const [name, setName] = useState(instance.name);
  const [description, setDescription] = useState(instance.description ?? "");
  const [min, setMin] = useState(instance.memoryMinMb);
  const [max, setMax] = useState(instance.memoryMaxMb);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api("instances:update", { id: instance.id, patch: { name, description, memoryMinMb: Number(min), memoryMaxMb: Number(max) } });
      notify(t("inst.updated"));
      onClose();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("inst.updateFailed"), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("inst.editTitle")} onClose={onClose}>
      <div className="grid">
        <Field label={t("common.name")}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t("inst.fDescription")}><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
        <div className="field-row">
          <Field label={t("inst.fRamMin")}><input type="number" value={min} onChange={(e) => setMin(Number(e.target.value))} /></Field>
          <Field label={t("inst.fRamMax")}><input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} /></Field>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn" disabled={busy} onClick={submit}>{busy ? t("common.loading") : t("common.save")}</button>
        </div>
      </div>
    </Modal>
  );
}
