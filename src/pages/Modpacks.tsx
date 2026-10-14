import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../components/store";
import { Empty } from "../components/ui";
import Select from "../components/Select";
import { fetchModrinthCovers } from "../lib/gallery";
import { IconSearch, IconDownload } from "../components/icons";

type Source = "modrinth" | "ftb" | "curseforge";

interface PackRow {
  key: string;
  title: string;
  description: string;
  author: string;
  iconUrl?: string;
  coverUrl?: string;
  meta: string;
  install: () => Promise<unknown>;
}

interface MrHit { project_id: string; title: string; description: string; author: string; icon_url?: string; downloads: number; versions: string[] }
interface FtbPack { id: number; name: string; synopsis: string; authors: { name: string }[]; installs: number; iconUrl?: string; splashUrl?: string; mcVersion?: string; versionsCount: number }
interface CfMod { id: number; name: string; summary: string; authors?: string[]; logoUrl?: string; downloadCount?: number }
interface CfFile { id: number; fileName: string; gameVersions: string[] }

export default function Modpacks() {
  const { notify, reloadAll, t, settings } = useApp();
  const [source, setSource] = useState<Source>("modrinth");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PackRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cfFiles, setCfFiles] = useState<Record<number, CfFile[]>>({});
  const [cfChoice, setCfChoice] = useState<Record<number, string>>({});
  const [installing, setInstalling] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});

  // Suggestions automatiques à l'ouverture (comme la page d'accueil des sites de modpacks),
  // et à chaque changement de source. Aucune recherche requise.
  useEffect(() => {
    if (source === "curseforge" && !settings?.curseforgeApiKey) {
      setSearched(true);
      setRows([]);
      return;
    }
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const search = async () => {
    setBusy(true);
    setSearched(true);
    try {
      if (source === "modrinth") {
        // Requête vide = sélection populaire (page d'accueil type).
        const hits = await api<MrHit[]>("modrinth:search", { query: query.trim(), projectType: "modpack" });
        setRows(hits.map((h) => ({
          key: `mr-${h.project_id}`,
          title: h.title,
          description: h.description,
          author: h.author,
          iconUrl: h.icon_url,
          coverUrl: undefined,
          meta: t("packs.versions", { n: h.versions.length }),
          install: () => api("modrinth:install-pack", { projectId: h.project_id }),
        })));
        void fetchModrinthCovers(hits.map((h) => h.project_id)).then((c) => {
          setCovers((prev) => ({ ...prev, ...c }));
        });
      } else if (source === "ftb") {
        const packs = await api<FtbPack[]>("ftb:packs", { query: query.trim() || undefined });
        setRows(packs.map((p) => ({
          key: `ftb-${p.id}`,
          title: p.name,
          description: p.synopsis,
          author: (p.authors ?? []).map((a) => a.name).join(", "),
          iconUrl: p.iconUrl,
          coverUrl: p.splashUrl,
          meta: [p.mcVersion ? t("packs.mc", { v: p.mcVersion }) : "", t("packs.versions", { n: p.versionsCount })].filter(Boolean).join(" • "),
          install: () => api("ftb:install", { packId: p.id }),
        })));
      } else {
        const res = await api<{ results: CfMod[] }>("curseforge:search", { query: query.trim() || "adventure", classId: 4471 });
        const list = res.results ?? [];
        setRows(list.map((m) => ({
          key: `cf-${m.id}`,
          title: m.name,
          description: m.summary ?? "",
          author: (m.authors ?? []).join(", "),
          coverUrl: m.logoUrl,
          meta: "",
          install: async () => {
            const fileId = Number(cfChoice[m.id]);
            if (!fileId) throw new Error(t("packs.chooseFile"));
            const files = cfFiles[m.id] ?? [];
            const file = files.find((f) => f.id === fileId) ?? files[0];
            if (!file) throw new Error(t("packs.chooseFile"));
            return api("curseforge:install-pack", { modId: m.id, fileId: file.id, fileName: file.fileName });
          },
        })));
        // Charge la liste des fichiers pour chaque résultat (choix de version explicite).
        for (const m of list.slice(0, 10)) {
          try {
            const files = await api<CfFile[]>("curseforge:files", { modId: m.id });
            setCfFiles((prev) => ({ ...prev, [m.id]: files }));
            if (files[0]) setCfChoice((prev) => ({ ...prev, [m.id]: String(files[0].id) }));
          } catch {
            /* catalogue partiel : le bouton d'installation expliquera l'erreur */
          }
        }
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : t("packs.loadFailed"), true);
      setRows([]);
    } finally {
      setBusy(false);
    }
  };

  const doInstall = async (row: PackRow) => {
    setInstalling(row.key);
    try {
      await row.install();
      notify(t("packs.installed", { t: row.title }));
      await reloadAll();
    } catch (e) {
      notify(e instanceof Error ? e.message : t("content.installFailed"), true);
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div>
      <h2 style={{ margin: "0 0 14px", fontSize: 19 }}>{t("packs.title")}</h2>
      <div className="tabs">
        {(["modrinth", "ftb", "curseforge"] as Source[]).map((s) => (
          <button key={s} className={`btn small${source === s ? "" : " ghost"}`} onClick={() => { setSource(s); setSearched(false); setRows([]); }}>
            {s === "modrinth" ? "Modrinth" : s === "ftb" ? "FTB" : "CurseForge"}
          </button>
        ))}
      </div>
      {source === "curseforge" && !settings?.curseforgeApiKey && (
        <p className="small" style={{ color: "var(--amber)" }}>{t("content.cfNoKey")}</p>
      )}
      <div className="row" style={{ marginBottom: 14 }}>
        <input style={{ maxWidth: 360 }} placeholder={t("packs.searchPh")} value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} />
        <button className="btn" disabled={busy} onClick={() => void search()}><IconSearch />{busy ? t("content.searching") : t("content.searchBtn")}</button>
      </div>

      {!searched ? (
        <Empty title={t("packs.title")} hint={t("packs.emptyHint")} />
      ) : !rows.length ? (
        <Empty title={t("packs.empty")} hint={t("packs.emptyHint")} />
      ) : (
        <>
          {!query.trim() && <h3 className="section-title">{t("common.popular")}</h3>}
          <div className="grid cards">
          {rows.map((r) => {
            const modId = r.key.startsWith("cf-") ? Number(r.key.slice(3)) : null;
            const mrId = r.key.startsWith("mr-") ? r.key.slice(3) : null;
            const cover = r.coverUrl ?? (mrId ? covers[mrId] : undefined);
            const files = modId !== null ? (cfFiles[modId] ?? []) : [];
            return (
              <div key={r.key} className="card">
                {cover && (
                  <div className="cover"><img src={cover} alt="" loading="lazy" /></div>
                )}
                <div className="row">
                  {r.iconUrl && <img src={r.iconUrl} alt="" width={40} height={40} style={{ borderRadius: 9 }} />}
                  <div>
                    <strong>{r.title}</strong>
                    {(r.author || r.meta) && <div className="muted small">{[r.author ? t("content.by", { a: r.author }) : "", r.meta].filter(Boolean).join(" • ")}</div>}
                  </div>
                </div>
                <p className="muted small">{r.description.slice(0, 220)}</p>
                {modId !== null && files.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <Select
                      value={cfChoice[modId] ?? ""}
                      onChange={(v) => setCfChoice((prev) => ({ ...prev, [modId]: v }))}
                      options={files.map((f) => ({ value: String(f.id), label: f.fileName, hint: f.gameVersions.slice(0, 4).join(", ") }))}
                    />
                  </div>
                )}
                <button className="btn small" disabled={installing === r.key} onClick={() => void doInstall(r)}>
                  <IconDownload />{installing === r.key ? t("common.loading") : t("content.install")}
                </button>
              </div>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
}
