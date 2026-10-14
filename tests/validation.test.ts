import { describe, it, expect } from "vitest";
import { validateMemory, validateSettings, defaultSettings } from "../electron/services/settings";
import { checkLoaderCompatibility } from "../electron/services/loaders";
import { validatePseudo } from "../electron/services/accounts";

describe("validation de la mémoire", () => {
  it("accepte une allocation normale", () => {
    expect(validateMemory(1024, 4096, 16384)).toBeNull();
  });
  it("refuse min > max", () => {
    expect(validateMemory(4096, 2048, 16384)).toMatch(/minimale/);
  });
  it("refuse plus de 85 % de la RAM totale", () => {
    expect(validateMemory(1024, 16000, 16384)).toMatch(/85/);
  });
  it("refuse les valeurs trop faibles", () => {
    expect(validateMemory(256, 512, 16384)).not.toBeNull();
  });
});

describe("validation des paramètres", () => {
  it("borne les téléchargements simultanés", () => {
    const s = validateSettings({ ...defaultSettings(), maxConcurrentDownloads: 99 });
    expect(s.maxConcurrentDownloads).toBeLessThanOrEqual(8);
  });
  it("normalise le thème inconnu vers sombre", () => {
    const s = validateSettings({ ...defaultSettings(), theme: "n importe quoi" as never });
    expect(s.theme).toBe("dark");
  });
  it("transparence activée par défaut, désactivable explicitement", () => {
    expect(defaultSettings().transparency).toBe(true);
    expect(validateSettings({ ...defaultSettings(), transparency: false }).transparency).toBe(false);
    expect(validateSettings({ ...defaultSettings(), transparency: undefined as never }).transparency).toBe(true);
  });
});

describe("compatibilité des chargeurs", () => {
  it("vanilla est toujours compatible", () => {
    expect(checkLoaderCompatibility("vanilla", "1.12.2")).toBeNull();
  });
  it("NeoForge exige 1.20.1+", () => {
    expect(checkLoaderCompatibility("neoforge", "1.19.4")).not.toBeNull();
    expect(checkLoaderCompatibility("neoforge", "1.20.1")).toBeNull();
  });
});

describe("validation des pseudonymes hors ligne", () => {
  it("accepte un pseudo valide", () => {
    expect(validatePseudo("Joueur_123")).toBeNull();
  });
  it("refuse les pseudos trop courts ou invalides", () => {
    expect(validatePseudo("ab")).not.toBeNull();
    expect(validatePseudo("pseudo avec espaces")).not.toBeNull();
    expect(validatePseudo("a".repeat(17))).not.toBeNull();
  });
});
