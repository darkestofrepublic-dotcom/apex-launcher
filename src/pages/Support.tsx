import { api } from "../lib/api";
import { useApp } from "../components/store";
import { IconDownload, IconFolder, IconCopy } from "../components/icons";
import { APP_VERSION } from "../../shared/version";

const LINKS = [
  { key: "sup.repo", url: "https://github.com/darkestofrepublic-dotcom/apex-launcher" },
  { key: "sup.issues", url: "https://github.com/darkestofrepublic-dotcom/apex-launcher/issues" },
  { key: "sup.modrinth", url: "https://modrinth.com" },
  { key: "sup.ftb", url: "https://www.feed-the-beast.com" },
] as const;

export default function Support() {
  const { notify, t } = useApp();

  const faqs = [1, 2, 3, 4, 5].map((n) => ({
    q: t(`sup.q${n}` as "sup.q1"),
    a: t(`sup.a${n}` as "sup.a1"),
  }));

  const exportDiag = () =>
    void api("logs:export-diagnostic", {}).then(() => notify(t("logs.exported"))).catch((e: Error) => notify(e.message, true));

  const openData = async () => {
    try {
      const info = await api<{ dataDir: string }>("system:info");
      await api("system:open-path", { target: info.dataDir });
      notify(t("sup.dataOpened"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.opFailed"), true);
    }
  };

  const copyInfo = async () => {
    try {
      const info = await api<Record<string, unknown>>("system:info");
      const text = [
        `Apex Launcher v${APP_VERSION} (ApexDevlabs)`,
        ...Object.entries(info).map(([k, v]) => `${k}: ${String(v)}`),
      ].join("\n");
      await navigator.clipboard.writeText(text);
      notify(t("sup.copied"));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("common.opFailed"), true);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{t("sup.title")}</h2>
      <div className="grid two">
        <div className="card">
          <div className="card-head"><h3>{t("sup.faq")}</h3></div>
          {faqs.map((f, i) => (
            <details key={i} style={{ marginBottom: 8 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13.5 }}>{f.q}</summary>
              <p className="muted small" style={{ margin: "6px 0 10px" }}>{f.a}</p>
            </details>
          ))}
        </div>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-head"><h3>{t("sup.actions")}</h3></div>
            <div className="row">
              <button className="btn ghost small" onClick={exportDiag}><IconDownload />{t("logs.export")}</button>
              <button className="btn ghost small" onClick={() => void openData()}><IconFolder />{t("sup.openData")}</button>
              <button className="btn ghost small" onClick={() => void copyInfo()}><IconCopy />{t("sup.copyInfo")}</button>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h3>{t("sup.links")}</h3></div>
            {LINKS.map((l) => (
              <p key={l.key} style={{ margin: "8px 0" }}>
                <a href={l.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>{t(l.key)}</a>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
