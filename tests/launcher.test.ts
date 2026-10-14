import { describe, it, expect } from "vitest";
import { diagnoseExit } from "../electron/services/launcher";
import { detectConflicts } from "../electron/services/mods";
import { pickCompatibleVersion } from "../electron/services/content";

describe("diagnostic de sortie du jeu", () => {
  it("détecte la mémoire insuffisante", () => {
    expect(diagnoseExit(1, "Exception: java.lang.OutOfMemoryError: Java heap space")).toMatch(/mémoire/i);
  });
  it("détecte une version Java inadaptée", () => {
    expect(diagnoseExit(1, "java.lang.UnsupportedClassVersionError: class file version 65")).toMatch(/Java/i);
  });
  it("reste prudent sans indice (pas de faux diagnostic)", () => {
    expect(diagnoseExit(1, "quelque chose d'inconnu")).toMatch(/Consultez/);
  });
});

describe("détection de conflits de mods", () => {
  it("signale les doublons actif + désactivé", () => {
    const warnings = detectConflicts([
      { fileName: "sodium.jar", enabled: true, size: 100 },
      { fileName: "sodium.jar.disabled", enabled: false, size: 100 },
    ]);
    expect(warnings.length).toBe(1);
  });
  it("ne signale rien sans doublon", () => {
    expect(detectConflicts([{ fileName: "a.jar", enabled: true, size: 1 }])).toHaveLength(0);
  });
});

describe("choix de version Modrinth compatible", () => {
  const versions = [
    { id: "v1", version_number: "1.0", game_versions: ["1.20.1"], loaders: ["fabric"], dependencies: [], files: [] },
    { id: "v2", version_number: "2.0", game_versions: ["1.21"], loaders: ["fabric"], dependencies: [], files: [] },
  ] as never[];
  it("préfère la version compatible avec le jeu et le chargeur", () => {
    const pick = pickCompatibleVersion(versions as never, "1.20.1", "fabric") as { id: string };
    expect(pick.id).toBe("v1");
  });
  it("ne choisit rien d'incompatible", () => {
    expect(pickCompatibleVersion(versions as never, "1.12.2", "forge")).toBeNull();
  });
});
