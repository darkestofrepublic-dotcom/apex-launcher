import { describe, it, expect } from "vitest";
import { mapLoader } from "../electron/services/ftb";
import { downloadAndApplyUpdate } from "../electron/services/updates";

describe("mappage des chargeurs FTB", () => {
  it("reconnaît neoforge, forge, fabric et quilt", () => {
    expect(mapLoader("neoforge")).toBe("neoforge");
    expect(mapLoader("forge")).toBe("forge");
    expect(mapLoader("fabric")).toBe("fabric");
    expect(mapLoader("quilt")).toBe("quilt");
  });
  it("retombe sur vanilla pour un chargeur inconnu", () => {
    expect(mapLoader("liteloader")).toBe("vanilla");
    expect(mapLoader("")).toBe("vanilla");
  });
});

describe("garde-fous de l'auto-update", () => {
  it("refuse les URL non HTTPS sans rien télécharger", async () => {
    const res = await downloadAndApplyUpdate("http://example.com/setup.exe");
    expect(res.ok).toBe(false);
  });
  it("refuse les liens qui ne pointent pas vers un .exe", async () => {
    const res = await downloadAndApplyUpdate("https://example.com/notes.txt");
    expect(res.ok).toBe(false);
  });
});
