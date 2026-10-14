import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Empty } from "../components/ui";
import Select from "../components/Select";
import { fetchModrinthCovers } from "../lib/gallery";
import { IconSearch, IconDownload, IconArchive } from "../components/icons";

interface Hit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  icon_url?: string;
  project_type: string;
  downloads: number;
}

const TYPES = ["mod", "modpack", "resourcepack", "shader", "datapack"] as const;

export default function Content() {
  const { instances, settings, notify, t } = useApp();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("mod");
  const [results, setResults] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [installTo, setInstallTo] = useState("");
  const [cfResults, setCfResults] = useState<{ id: number; name: string; summary: string; logoUrl?: string }[]>([]);
  const [covers, setCovers] = useState<Record<string, string>>({});

  // Suggestions automatiques à l'ouverture (requête vide = sélection populaire).
  useEffect(() => {
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeLabel = (id: string) =>
    id === "mod" ? t("content.tMod") : id === "modpack" ? t("content.tModpack") : id === "resourcepack" ? t("content.tResource") : id === "shader" ? t("content.tShader") : t("content.tDatapack");

  const search = async () => {
    setBusy(true);
    setSearched(true);
    try {
      const inst = instances.find((i) => i.id === installTo) ?? instances[0];
      const hits = await api<Hit[]>("modrinth:search", {
        query,
        projectType: type,
        gameVersion: inst?.minecraftVersion,
        loader: inst && inst.loader !== "vanilla" ? inst.loader : undefined,
      });
      setResults(hits);
      void fetchModrinthCovers(hits.map((h) => h.project_id)).then((c) =>
        setCovers((prev) => ({ ...prev, ...c })),
      );
      try {
        const cf = await api<{ results: { id: number; name: string; summary: string; logoUrl?: string }[] }>("curseforge:search", { query, gameVersion: inst?.minecraftVersion });
        setCfResults(cf.results.slice(0, 10));
      } catch {
        setCfResults([]);
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : t("content.searchFailed"), true);
    } finally {
      setBusy(false);
    }
  };

  const install = async (projectId: string, title: string) => {
    const inst = instances.find((i) => i.id === installTo) ?? instances[0];
    if (!inst) {
      notify(t("home.needInstance"), true);
      return;
    }
    const target = type === "resourcepack" ? "resourcepacks" : type === "shader" ? "shaderpacks" : type === "datapack" ? "datapacks" : "mods";
    try {
      await api("modrinth:install", { projectId, instanceDir: inst.directory, target, gameVersion: inst.minecraftVersion, loader: inst.loader });
      notify(t("content.queued", { t: title, i: inst.name }));
    } catch (e) {
      notify(e instanceof Error ? e.message : t("content.installFailed"), true);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{t("content.title")}</h2>
      <div className="tabs">
        {TYPES.map((id) => (
          <button key={id} className={`btn small${type === id ? "" : " ghost"}`} onClick={() => setType(id)}>{typeLabel(id)}</button>
        ))}
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <input style={{ maxWidth: 340 }} placeholder={t("content.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} />
        <Select
          value={installTo}
          onChange={setInstallTo}
          width={250}
          options={[
            { value: "", label: t("content.installIn", { n: instances[0]?.name ?? "—" }) },
            ...instances.map((i) => ({ value: i.id, label: i.name, hint: `${i.minecraftVersion} • ${i.loader}` })),
          ]}
        />
        <button className="btn" disabled={busy} onClick={() => void search()}><IconSearch />{busy ? t("content.searching") : t("content.searchBtn")}</button>
        <button className="btn ghost" onClick={() => void api("modpacks:import-mrpack", {}).catch((e: Error) => notify(e.message, true))}><IconArchive />{t("content.importMrpack")}</button>
      </div>

      {!searched ? (
        <Empty title={t("content.discover")} hint={t("content.discoverHint")} />
      ) : !results.length ? (
        <Empty title={t("content.noResults")} hint={t("content.noResultsHint")} />
      ) : (
        <>
          {!query.trim() && <h3 className="section-title">{t("common.popular")}</h3>}
          <div className="grid cards">
          {results.map((r) => (
            <div key={r.project_id} className="card">
              {covers[r.project_id] && (
                <div className="cover"><img src={covers[r.project_id]} alt="" loading="lazy" /></div>
              )}
              <div className="row">
                {r.icon_url && <img src={r.icon_url} alt="" width={38} height={38} style={{ borderRadius: 8 }} />}
                <div>
                  <strong>{r.title}</strong>
                  <div className="muted small">{t("content.by", { a: r.author })} • {t("content.dlCount", { n: r.downloads.toLocaleString() })}</div>
                </div>
              </div>
              <p className="muted small">{r.description}</p>
              <button className="btn small" onClick={() => void install(r.project_id, r.title)}><IconDownload />{t("content.install")}</button>
            </div>
          ))}
          </div>
        </>
      )}

      {searched && (
        <>
          <h3 className="section-title">{t("content.cf")}</h3>
          {!cfResults.length ? (
            <p className="muted small">{!settings?.curseforgeApiKey ? t("content.cfNoKey") : t("content.cfEmpty")}</p>
          ) : (
            <div className="grid cards">
              {cfResults.map((c) => (
                <div key={c.id} className="card">
                  {c.logoUrl && (
                    <div className="cover"><img src={c.logoUrl} alt="" loading="lazy" /></div>
                  )}
                  <strong>{c.name}</strong>
                  <p className="muted small">{c.summary}</p>
                  <p className="muted small">{t("content.cfManual")}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
