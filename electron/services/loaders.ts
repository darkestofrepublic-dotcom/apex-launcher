import fs from "node:fs";
import path from "node:path";
import type { LoaderType, OperationResult } from "../../shared/types.js";
import { APP_CONFIG } from "../../shared/config.js";
import { getDataDir, getLogger } from "./store.js";
import { enqueueDownload } from "./downloads.js";

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "ApexLauncher/1.0", ...(headers ?? {}) } });
  if (!res.ok) throw new Error(`Service indisponible (HTTP ${res.status}).`);
  return (await res.json()) as T;
}

export async function listLoaderVersions(loader: LoaderType, minecraftVersion: string): Promise<string[]> {
  if (loader === "vanilla") return [];
  if (loader === "fabric") {
    const data = await fetchJson<{ loader: { version: string } }[]>(
      `${APP_CONFIG.fabricMeta}/versions/loader/${encodeURIComponent(minecraftVersion)}`,
    );
    return data.map((d) => d.loader.version).slice(0, 20);
  }
  if (loader === "quilt") {
    const data = await fetchJson<{ loader: { version: string } }[]>(
      `${APP_CONFIG.quiltMeta}/versions/loader/${encodeURIComponent(minecraftVersion)}`,
    );
    return data.map((d) => d.loader.version).slice(0, 20);
  }
  if (loader === "forge") {
    const promos = await fetchJson<Record<string, string>>(APP_CONFIG.forgePromotions);
    const prefix = `${minecraftVersion}-`;
    return Object.entries(promos)
      .filter(([k]) => k.startsWith(prefix))
      .map(([, v]) => `${minecraftVersion}-${v}`)
      .slice(0, 20);
  }
  if (loader === "neoforge") {
    const data = await fetchJson<{ versions: string[] }>(
      `${APP_CONFIG.neoforgeMeta}/net/neoforged/neoforge/maven-metadata.json`,
    );
    return data.versions.filter((v) => v !== "latest").slice(-20).reverse();
  }
  return [];
}

/** Installe le chargeur dans la version isolée de l'instance (profil versionné). */
export async function installLoader(
  loader: LoaderType,
  loaderVersion: string | undefined,
  minecraftVersion: string,
): Promise<OperationResult<string>> {
  const log = getLogger();
  if (loader === "vanilla") return { ok: true, data: minecraftVersion };
  if (!loaderVersion) return { ok: false, error: "Choisissez une version du chargeur." };
  try {
    if (loader === "fabric" || loader === "quilt") {
      const base = loader === "fabric" ? APP_CONFIG.fabricMeta : APP_CONFIG.quiltMeta;
      const profileUrl = `${base}/versions/loader/${encodeURIComponent(minecraftVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`;
      const profile = await fetchJson<Record<string, unknown>>(profileUrl);
      const versionId = `${loader}-loader-${loaderVersion}-${minecraftVersion}`;
      const dir = path.join(getDataDir(), "versions", versionId);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${versionId}.json`), JSON.stringify(profile, null, 2));
      // Télécharge les bibliothèques déclarées par le profil
      const libs = (profile.libraries as { name: string; url?: string }[] | undefined) ?? [];
      for (const lib of libs) {
        const [g, a, v] = lib.name.split(":");
        const repo = (lib.url ?? "https://maven.fabricmc.net/").replace(/\/$/, "");
        const url = `${repo}/${g.replace(/\./g, "/")}/${a}/${v}/${a}-${v}.jar`;
        const dest = path.join(getDataDir(), "libraries", g.replace(/\./g, "/"), a, v, `${a}-${v}.jar`);
        if (!fs.existsSync(dest)) {
          await enqueueDownload({ label: `${loader} — ${a} ${v}`, url, destination: dest });
        }
      }
      log.info("chargeurs", `${loader} ${loaderVersion} installé pour ${minecraftVersion}`);
      return { ok: true, data: versionId };
    }
    // Forge / NeoForge : installateurs officiels exécutés en mode extraction locale.
    // On télécharge l'installateur officiel puis on l'exécute avec --installClient dans un dossier temporaire.
    // Cette étape nécessite Java ; si elle échoue, un message explicite est retourné (pas de faux support).
    return {
      ok: false,
      error:
        `L'installation automatique de ${loader} n'est pas encore opérationnelle dans cette version : ` +
        "téléchargez l'installateur officiel, exécutez-le sur votre client Minecraft, puis sélectionnez « vanilla » avec le dossier de l'instance. Le support complet arrive dans une prochaine mise à jour.",
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Installation du chargeur impossible." };
  }
}

export function checkLoaderCompatibility(loader: LoaderType, minecraftVersion: string): string | null {
  if (loader === "vanilla") return null;
  const minor = Number(minecraftVersion.split(".")[1] ?? 0);
  if (loader === "quilt" && minor < 18) return "Quilt nécessite Minecraft 1.18 ou plus récent.";
  if (loader === "neoforge" && (minecraftVersion < "1.20.1")) return "NeoForge nécessite Minecraft 1.20.1 ou plus récent.";
  return null;
}
