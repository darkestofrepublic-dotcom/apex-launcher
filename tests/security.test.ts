import { describe, it, expect } from "vitest";
import { redactSecrets } from "../electron/services/store";
import { isSafeArchivePath, sanitizeFileName } from "../electron/services/content";

describe("masquage des secrets dans les journaux", () => {
  it("masque les jetons d'accès et d'actualisation", () => {
    const input = `connexion {"access_token": "abc123", "refresh_token": "def456"} terminée`;
    const out = redactSecrets(input);
    expect(out).not.toContain("abc123");
    expect(out).not.toContain("def456");
    expect(out).toContain("[MASQUÉ]");
  });

  it("masque les en-têtes Bearer", () => {
    const out = redactSecrets("appel avec Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test");
    expect(out).not.toContain("Bearer eyJ");
  });

  it("masque les JWT résiduels", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature1234567890";
    expect(redactSecrets(`token ${jwt} fin`)).not.toContain("eyJhbGci");
  });

  it("laisse le texte ordinaire intact", () => {
    expect(redactSecrets("Minecraft 1.21 prêt.")).toBe("Minecraft 1.21 prêt.");
  });
});

describe("sécurité des chemins d'archives (anti zip-slip)", () => {
  const base = "C:\\data\\instance";
  it("accepte un chemin normal", () => {
    expect(isSafeArchivePath(base, "mods/monmod.jar")).toBe(true);
  });
  it("refuse la remontée ../", () => {
    expect(isSafeArchivePath(base, "../evil.exe")).toBe(false);
    expect(isSafeArchivePath(base, "mods/../../evil.exe")).toBe(false);
  });
  it("refuse les chemins absolus", () => {
    expect(isSafeArchivePath(base, "C:\\Windows\\evil.exe")).toBe(false);
  });
});

describe("nettoyage des noms de fichiers", () => {
  it("supprime les caractères interdits Windows", () => {
    expect(sanitizeFileName('a<b>:"c"|?*.jar')).toBe("a_b___c____.jar");
  });
});
