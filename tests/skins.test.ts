import { describe, it, expect } from "vitest";
import { parsePngDimensions, isValidSkinSize } from "../electron/services/skins";
import { pickFeaturedImage } from "../src/lib/gallery";

function makePng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33, 0);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buf, 0);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

describe("validation des skins PNG", () => {
  it("lit les dimensions d'un PNG valide", () => {
    expect(parsePngDimensions(makePng(64, 64))).toEqual({ width: 64, height: 64 });
  });
  it("rejette les fichiers non PNG", () => {
    expect(parsePngDimensions(Buffer.from("ceci n'est pas un png du tout.........."))).toBeNull();
    expect(parsePngDimensions(Buffer.alloc(10))).toBeNull();
  });
  it("n'accepte que 64×64 et 64×32", () => {
    expect(isValidSkinSize(64, 64)).toBe(true);
    expect(isValidSkinSize(64, 32)).toBe(true);
    expect(isValidSkinSize(128, 128)).toBe(false);
    expect(isValidSkinSize(64, 128)).toBe(false);
  });
});

describe("choix de l'image de galerie", () => {
  it("préfère l'image vedette", () => {
    expect(
      pickFeaturedImage([
        { url: "a.jpg", featured: false },
        { url: "b.jpg", featured: true },
      ]),
    ).toBe("b.jpg");
  });
  it("prend la première image sinon, null si vide", () => {
    expect(pickFeaturedImage([{ url: "a.jpg", featured: false }])).toBe("a.jpg");
    expect(pickFeaturedImage([])).toBeNull();
  });
});

describe("pipeline des skins (local, sans réseau)", () => {
  it("importe un PNG 64×64 valide et gère le skin actif", async () => {
    const { uploadSkin, listSkins, setActiveSkin } = await import("../electron/services/skins");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const buf = makePng(64, 64);
    const tmp = path.join(os.tmpdir(), `skin-test-${Date.now()}.png`);
    fs.writeFileSync(tmp, buf);
    const res = uploadSkin(tmp, "Testeur");
    expect(res.ok).toBe(true);
    expect(res.data?.width).toBe(64);
    const store = listSkins();
    expect(store.skins.map((s) => s.id)).toContain(res.data?.id);
    // Activation explicite : déterministe quel que soit l'état précédent du magasin.
    const activated = setActiveSkin(res.data!.id);
    expect(activated.ok).toBe(true);
    expect(listSkins().activeId).toBe(res.data?.id);
    fs.rmSync(tmp, { force: true });
  });

  it("rejette un PNG aux mauvaises dimensions", async () => {
    const { uploadSkin } = await import("../electron/services/skins");
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const tmp = path.join(os.tmpdir(), `skin-bad-${Date.now()}.png`);
    fs.writeFileSync(tmp, makePng(128, 128));
    const res = uploadSkin(tmp);
    expect(res.ok).toBe(false);
    fs.rmSync(tmp, { force: true });
  });

  it("refuse d'appliquer un skin sur une instance vanilla", async () => {
    const { createInstance } = await import("../electron/services/instances");
    const { applySkinToInstance } = await import("../electron/services/skins");
    const created = createInstance({ name: "VanillaTest", minecraftVersion: "1.21", loader: "vanilla" });
    expect(created.ok).toBe(true);
    const res = await applySkinToInstance(created.data!.id);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/moddée/);
  });
});
