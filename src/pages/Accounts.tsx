import { useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Modal, Field } from "../components/ui";
import { IconPlus, IconRefresh, IconLogout, IconEdit } from "../components/icons";
import type { Account } from "../../shared/types";

export default function Accounts() {
  const { accounts, activeAccount, reloadAll, notify, t } = useApp();
  const [showOffline, setShowOffline] = useState(false);
  const [msHint, setMsHint] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshHint = async () => {
    try {
      const res = await api<{ microsoft: { hint: string } }>("accounts:get-active");
      setMsHint(res.microsoft.hint);
    } catch {
      /* ignore */
    }
  };
  if (!msHint) void refreshHint();

  const msLogin = async () => {
    setBusy(true);
    try {
      await api("auth:microsoft-start", {});
      notify(t("acc.msConnected"));
      await reloadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("acc.loginFailed"), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>{t("acc.title")}</h2>
        <div className="row">
          <button className="btn ghost" onClick={() => setShowOffline(true)}><IconPlus />{t("acc.addOffline")}</button>
          <button className="btn" disabled={busy} onClick={msLogin}>{busy ? t("acc.connecting") : t("acc.msLogin")}</button>
        </div>
      </div>
      <p className="muted small">{msHint}</p>
      <p className="muted small">{t("acc.noPassword")}</p>

      <div className="grid cards">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} active={activeAccount?.id === a.id} />
        ))}
      </div>
      {accounts.length === 0 && <p className="muted">{t("acc.none")}</p>}

      {showOffline && <OfflineForm onClose={() => { setShowOffline(false); void reloadAll(); }} />}
    </div>
  );
}

function AccountCard({ account, active }: { account: Account; active: boolean }) {
  const { reloadAll, notify, t } = useApp();
  const [renaming, setRenaming] = useState(false);

  const remove = async () => {
    if (!confirm(t("acc.deleteConfirm", { n: account.displayName }))) return;
    try {
      await api("accounts:remove", { id: account.id });
      notify(t("acc.deleted"));
      await reloadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.deleteFailed"), true);
    }
  };

  return (
    <div className="card" style={active ? { borderColor: "var(--accent)" } : undefined}>
      <div className="row">
        <div className="avatar">
          {account.avatarPath ? <img src={`file://${account.avatarPath}`} alt="" /> : account.displayName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <strong>{account.displayName}</strong>
          <div style={{ marginTop: 4 }}>
            <span className={`pill${account.type === "offline" ? " amber" : " blue"}`}>
              {account.type === "microsoft" ? t("acc.microsoft") : t("acc.offline")}
            </span>
          </div>
        </div>
      </div>
      <p className="muted small mono">UUID {account.uuid}</p>
      <div className="row">
        {!active && <button className="btn small" onClick={() => void api("accounts:set-active", { id: account.id }).then(() => reloadAll())}>{t("acc.use")}</button>}
        {active && <span className="pill green">{t("acc.active")}</span>}
        {account.type === "offline" && <button className="btn ghost small" onClick={() => setRenaming(true)}><IconEdit />{t("acc.rename")}</button>}
        {account.type === "microsoft" && (
          <button className="btn ghost small" onClick={() => void api("auth:microsoft-refresh", { id: account.id }).then(() => { notify(t("acc.refreshed")); void reloadAll(); }).catch((e: Error) => notify(e.message, true))}>
            <IconRefresh />{t("acc.refresh")}
          </button>
        )}
        <button className="btn ghost small" onClick={remove}><IconLogout />{t("common.delete")}</button>
      </div>
      {renaming && <OfflineForm existing={account} onClose={() => { setRenaming(false); void reloadAll(); }} />}
    </div>
  );
}

function OfflineForm({ existing, onClose }: { existing?: Account; onClose: () => void }) {
  const { notify, t } = useApp();
  const [pseudo, setPseudo] = useState(existing?.displayName ?? "");
  const [avatar, setAvatar] = useState(existing?.avatarPath ?? "");

  const pickAvatar = async () => {
    try {
      const dest = await api<string | null>("system:pick-avatar", {});
      if (dest) setAvatar(dest);
    } catch (e) {
      notify(e instanceof Error ? e.message : t("acc.avatarFailed"), true);
    }
  };

  const submit = async () => {
    try {
      if (existing) {
        await api("accounts:update-offline", { id: existing.id, pseudo, avatarPath: avatar || undefined });
        notify(t("acc.updated"));
      } else {
        await api("accounts:create-offline", { pseudo, avatarPath: avatar || undefined });
        notify(t("acc.created", { n: pseudo }));
      }
      onClose();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.createFailed"), true);
    }
  };

  return (
    <Modal title={existing ? t("acc.renameTitle") : t("acc.newTitle")} onClose={onClose}>
      <div className="grid">
        <Field label={t("acc.pseudo")}>
          <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} placeholder={t("acc.pseudoPh")} />
        </Field>
        <div className="row">
          <div className="avatar" style={{ width: 44, height: 44 }}>
            {avatar ? <img src={`file://${avatar}`} alt="" /> : pseudo.slice(0, 1).toUpperCase()}
          </div>
          <button className="btn ghost small" onClick={pickAvatar}>{t("acc.pickAvatar")}</button>
        </div>
        <p className="muted small">{t("acc.offlineNote")}</p>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn" onClick={submit}>{existing ? t("common.save") : t("common.create")}</button>
        </div>
      </div>
    </Modal>
  );
}
