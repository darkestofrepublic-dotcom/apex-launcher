import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { IconRefresh, IconFolder } from "../components/icons";

interface JavaInfo {
  path: string;
  version: string;
  major: number;
  source: string;
}

export default function JavaPage() {
  const { notify, t } = useApp();
  const [installs, setInstalls] = useState<JavaInfo[]>([]);
  const [totalMb, setTotalMb] = useState(0);
  const [freeMb, setFreeMb] = useState(0);
  const [version, setVersion] = useState("1.21");
  const [preferred, setPreferred] = useState("");
  const [result, setResult] = useState("");

  const refresh = async () => {
    try {
      const res = await api<{ installs: JavaInfo[]; totalMb: number; freeMb: number }>("java:detect");
      setInstalls(res.installs);
      setTotalMb(res.totalMb);
      setFreeMb(res.freeMb);
    } catch (e) {
      notify(e instanceof Error ? e.message : t("java.detectFailed"), true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const ensure = async () => {
    setResult(t("java.verifying"));
    try {
      const res = await api<{ ok: boolean; data?: string; error?: string; recommended: number }>("java:ensure", { minecraftVersion: version, preferred: preferred || undefined });
      setResult(res.ok ? t("java.ready", { p: res.data ?? "", r: res.recommended }) : t("java.failed", { e: res.error ?? "" }));
    } catch (e) {
      setResult(e instanceof Error ? e.message : t("common.opFailed"));
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>{t("java.title")}</h2>
      <p className="muted small">{t("java.sysmem", { t: totalMb, f: freeMb })}</p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>{t("java.detected", { n: installs.length })}</h3></div>
        {!installs.length ? (
          <p className="muted small">{t("java.none")}</p>
        ) : (
          <table>
            <thead><tr><th>{t("java.path")}</th><th>{t("java.version")}</th><th>{t("java.source")}</th></tr></thead>
            <tbody>
              {installs.map((j) => (
                <tr key={j.path}><td className="mono">{j.path}</td><td>{j.version} (Java {j.major})</td><td>{j.source}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn ghost small" onClick={() => void refresh()}><IconRefresh />{t("common.refresh")}</button>
          <button className="btn ghost small" onClick={() => void api<string | null>("java:select-file", {}).then((p) => { if (p) setPreferred(p); }).catch((e: Error) => notify(e.message, true))}>
            <IconFolder />{t("java.manual")}
          </button>
          {preferred && <span className="muted small mono">{preferred}</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>{t("java.verify")}</h3></div>
        <div className="row">
          <input style={{ maxWidth: 180 }} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.21" />
          <button className="btn" onClick={ensure}>{t("java.verifyBtn")}</button>
        </div>
        {result && <p className="muted small">{result}</p>}
        <p className="muted small">{t("java.note")}</p>
      </div>
    </div>
  );
}
