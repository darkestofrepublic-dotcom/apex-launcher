import { api } from "./api";

/** Récupère les images de galerie (vedette sinon première) pour des projets Modrinth. */
export async function fetchModrinthCovers(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    ids.slice(0, 25).map(async (id) => {
      try {
        const p = await api<{ gallery?: { url: string; featured: boolean }[] }>("modrinth:project", { id });
        const gallery = p.gallery ?? [];
        const featured = gallery.find((g) => g.featured) ?? gallery[0];
        if (featured?.url) out[id] = featured.url;
      } catch {
        /* aperçu indisponible : la carte garde son dégradé */
      }
    }),
  );
  return out;
}

/** Choisit l'image vedette d'une galerie (fonction pure, testée). */
export function pickFeaturedImage(gallery: { url: string; featured: boolean }[]): string | null {
  if (!gallery.length) return null;
  return (gallery.find((g) => g.featured) ?? gallery[0]).url ?? null;
}
