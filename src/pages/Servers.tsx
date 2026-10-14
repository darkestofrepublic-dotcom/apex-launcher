import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Modal, Field, Empty } from "../components/ui";
import { IconPlus, IconStar, IconCopy, IconEdit, IconTrash } from "../components/icons";
import type { ServerEntry } from "../../shared/types";

export default function Servers() {
  const { instances, notify, t, lang } = useApp();
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Partial<ServerEntry> | null>(null);

  const refresh = async () => {
    try {
      setServers(await api<ServerEntry[]>("servers:list"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.loadFailed"), true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const join = async (s: ServerEntry) => {
    const inst = instances[0];
    if (!inst) {
      notify(t("srv.needInstance"), true);
      return;
    }
    try {
      await api("launch:play", { instanceId: inst.id, serverId: s.id });
    } catch (e) {
      notify(e instanceof Error ? e.message : t("srv.joinFailed"), true);
    }
  };

  const locale = lang === "en" ? "en-US" : "fr-FR";

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t("srv.title")}</h2>
        <button className="btn" onClick={() => { setEditing({}); setShowForm(true); }}><IconPlus />{t("srv.add")}</button>
      </div>
      {!servers.length ? (
        <Empty title={t("srv.none")} hint={t("srv.noneHint")} />
      ) : (
        <div className="grid cards">
          {servers.map((s) => (
            <div key={s.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{s.name}</strong>
                {s.favorite ? <span className="pill amber"><IconStar />{s.category}</span> : s.category ? <span className="pill">{s.category}</span> : null}
              </div>
              <p className="mono" style={{ margin: "10px 0" }}>{s.address}{s.port ? `:${s.port}` : ""}</p>
              {s.description && <p className="muted small">{s.description}</p>}
              {s.lastPlayedAt && <p className="muted small">{t("srv.last", { d: new Date(s.lastPlayedAt).toLocaleString(locale) })}</p>}
              <div className="row">
                <button className="btn small" onClick={() => void join(s)}>{t("srv.join")}</button>
                <button className="btn ghost small" onClick={() => void api("servers:copy-address", { id: s.id }).then(() => notify(t("srv.copied"))).catch((e: Error) => notify(e.message, true))}><IconCopy />{t("srv.copy")}</button>
                <button className="icon-btn" title={t("common.edit")} onClick={() => { setEditing(s); setShowForm(true); }}><IconEdit /></button>
                <button className="icon-btn" title={t("common.delete")} onClick={() => { if (confirm(t("srv.deleteConfirm", { n: s.name }))) void api("servers:remove", { id: s.id }).then(() => refresh()); }}><IconTrash /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && editing && (
        <ServerForm initial={editing} onClose={() => { setShowForm(false); setEditing(null); void refresh(); }} />
      )}
    </div>
  );
}

function ServerForm({ initial, onClose }: { initial: Partial<ServerEntry>; onClose: () => void }) {
  const { notify, t } = useApp();
  const [name, setName] = useState(initial.name ?? "");
  const [address, setAddress] = useState(initial.address ?? "");
  const [port, setPort] = useState(initial.port ? String(initial.port) : "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [favorite, setFavorite] = useState(initial.favorite ?? false);

  const submit = async () => {
    try {
      await api("servers:save", { id: initial.id, name, address, port: port ? Number(port) : undefined, description, category, favorite });
      notify(t("srv.saved"));
      onClose();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.saveFailed"), true);
    }
  };

  return (
    <Modal title={initial.id ? t("srv.editTitle") : t("srv.addTitle")} onClose={onClose}>
      <div className="grid">
        <Field label={t("srv.fName")}><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("srv.fNamePh")} /></Field>
        <div className="field-row">
          <Field label={t("srv.fAddress")}><input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t("srv.fAddressPh")} /></Field>
          <Field label={t("srv.fPort")}><input value={port} onChange={(e) => setPort(e.target.value)} placeholder="25565" /></Field>
        </div>
        <Field label={t("srv.fDescription")}><input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="field-row">
          <Field label={t("srv.fCategory")}><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("srv.fCategoryPh")} /></Field>
          <label className="row">{t("srv.fFavorite")} <input type="checkbox" style={{ width: 18 }} checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /></label>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn" onClick={submit}>{t("common.save")}</button>
        </div>
      </div>
    </Modal>
  );
}
