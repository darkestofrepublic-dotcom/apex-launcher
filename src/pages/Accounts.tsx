import { useState } from "react";
import { api } from "../lib/api";
import { useApp, type TKey } from "../components/store";
import { Modal, Field } from "../components/ui";
import { IconPlus, IconRefresh, IconLogout, IconEdit, IconCheck } from "../components/icons";
import type { Account, LauncherSettings } from "../../shared/types";

const MS_ERROR_KEYS: Record<string, "acc.errNotConfigured" | "acc.errInvalidId" | "acc.errTimeout" | "acc.errCancelled" | "acc.errAppNotFound" | "acc.errRedirect" | "acc.errNoMinecraft"> = {
  ERR_MS_NOT_CONFIGURED: "acc.errNotConfigured",
  ERR_MS_INVALID_ID: "acc.errInvalidId",
  ERR_MS_TIMEOUT: "acc.errTimeout",
  ERR_MS_CANCELLED: "acc.errCancelled",
  ERR_MS_APP_NOT_FOUND: "acc.errAppNotFound",
  ERR_MS_REDIRECT_MISMATCH: "acc.errRedirect",
  ERR_MS_NO_MINECRAFT: "acc.errNoMinecraft",
};

function msErrorMessage(t: (key: TKey, params?: Record<string, string | number>) => string, raw?: string): string {
  if (!raw) return t("acc.loginFailed");
  const key = MS_ERROR_KEYS[raw];
  return key ? t(key) : raw;
}

export default function Accounts() {
  const { accounts, activeAccount, reloadAll, notify, t, settings } = useApp();
  const [showOffline, setShowOffline] = useState(false);
  const [msHint, setMsHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientIdError, setClientIdError] = useState("");

  const msError = (raw?: string) => msErrorMessage(t, raw);

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
      notify(msError(e instanceof Error ? e.message : undefined), true);
    } finally {
      setBusy(false);
    }
  };

  const saveClientId = async () => {
    const value = (clientId ?? settings?.microsoftClientId ?? "").trim();
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value)) {
      setClientIdError(t("acc.clientIdInvalid"));
      return;
    }
    setClientIdError("");
    try {
      await api<LauncherSettings>("settings:update", { microsoftClientId: value });
      setClientId(value);
      notify(t("acc.clientIdSaved"));
      await reloadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.saveFailed"), true);
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

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>{t("acc.guideTitle")}</h3></div>
        <p className="muted small">{t("acc.guideIntro")}</p>
        <ol className="muted small" style={{ margin: "8px 0", paddingLeft: 20, display: "grid", gap: 6 }}>
          <li>{t("acc.guideS1")} <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{t("acc.openPortal")}</a></li>
          <li>{t("acc.guideS2")}</li>
          <li>{t("acc.guideS3")}</li>
          <li>{t("acc.guideS4")} <span className="mono">http://localhost:19855/callback</span></li>
          <li>{t("acc.guideS5")}</li>
        </ol>
        <div className="row" style={{ marginTop: 10 }}>
          <input
            style={{ maxWidth: 360 }}
            placeholder={t("acc.clientIdPh")}
            value={clientId ?? settings?.microsoftClientId ?? ""}
            onChange={(e) => { setClientId(e.target.value); setClientIdError(""); }}
          />
          <button className="btn small" onClick={saveClientId}><IconCheck />{t("common.save")}</button>
          {settings?.microsoftClientId && <span className="pill green">{t("acc.clientIdSaved")}</span>}
        </div>
        {clientIdError && <p className="small" style={{ color: "var(--red)" }}>{clientIdError}</p>}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>{t("acc.signupTitle")}</h3></div>
        <p className="muted small">{t("acc.signupText")}</p>
        <div className="row">
          <a className="btn" href="https://www.minecraft.net/store/minecraft-java-bedrock-edition-pc" target="_blank" rel="noreferrer">{t("acc.buyMinecraft")}</a>
          <a className="btn ghost" href="https://signup.live.com/" target="_blank" rel="noreferrer">{t("acc.createMs")}</a>
        </div>
      </div>

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
          <button className="btn ghost small" onClick={() => void api("auth:microsoft-refresh", { id: account.id }).then(() => { notify(t("acc.refreshed")); void reloadAll(); }).catch((e: Error) => notify(msErrorMessage(t, e.message), true))}>
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
