import { describe, it, expect } from "vitest";
import { STRINGS } from "../src/i18n/dict";

describe("dictionnaires de langue", () => {
  it("le français et l'anglais ont exactement les mêmes clés", () => {
    const fr = Object.keys(STRINGS.fr).sort();
    const en = Object.keys(STRINGS.en).sort();
    expect(en).toEqual(fr);
  });

  it("aucune chaîne vide", () => {
    for (const [lang, dict] of Object.entries(STRINGS)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim().length, `${lang}:${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("l'interpolation conserve les paramètres inconnus au lieu de planter", async () => {
    const { format } = await import("../src/i18n/dict");
    expect(format("Version {v} • {missing}", { v: "1.0" })).toBe("Version 1.0 • {missing}");
  });
});
