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

describe("repli de mise à jour sans API (pur, sans réseau)", () => {
  it("déduit tag et URL depuis la redirection de la page releases/latest", async () => {
    const { parseGithubFallback } = await import("../electron/services/updates");
    expect(
      parseGithubFallback(
        "https://api.github.com/darkestofrepublic-dotcom/apex-launcher/releases/latest",
        "https://github.com/darkestofrepublic-dotcom/apex-launcher/releases/tag/v1.0.10",
      ),
    ).toEqual({
      latest: "1.0.10",
      downloadUrl: "https://github.com/darkestofrepublic-dotcom/apex-launcher/releases/download/v1.0.10/ApexLauncher-Setup-x64.exe",
    });
  });
  it("refuse les flux non GitHub et les redirections sans tag", async () => {
    const { parseGithubFallback } = await import("../electron/services/updates");
    expect(parseGithubFallback("https://example.com/feed.json", "https://example.com/v1")).toBeNull();
    expect(
      parseGithubFallback(
        "https://api.github.com/o/r/releases/latest",
        "https://github.com/o/r/releases",
      ),
    ).toBeNull();
  });
});
