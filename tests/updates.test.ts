import { describe, it, expect } from "vitest";
import { compareVersions } from "../electron/services/updates";
import { APP_VERSION } from "../shared/version";
import pkg from "../package.json";

describe("comparaison de versions semver", () => {
  it("détecte une version plus récente", () => {
    expect(compareVersions("1.0.2", "1.0.1")).toBe(1);
    expect(compareVersions("1.1.0", "1.0.9")).toBe(1);
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
  });
  it("détecte l'égalité (avec ou sans préfixe v)", () => {
    expect(compareVersions("v1.0.1", "1.0.1")).toBe(0);
  });
  it("détecte une version plus ancienne", () => {
    expect(compareVersions("1.0.0", "1.0.1")).toBe(-1);
  });
});

describe("source unique de version", () => {
  it("shared/version.ts est synchronisé avec package.json", () => {
    expect(APP_VERSION).toBe((pkg as { version: string }).version);
  });
  it("le format est semver x.y.z", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
