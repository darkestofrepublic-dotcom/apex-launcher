// Augmente la version (patch par défaut) : package.json + shared/version.ts + entrée CHANGELOG.
// Usage : npm run bump -- patch|minor|major
// Règle du projet : chaque correctif livré augmente la version.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const kind = process.argv[2] ?? "patch";
if (!["patch", "minor", "major"].includes(kind)) {
  console.error("Usage : npm run bump -- patch|minor|major");
  process.exit(1);
}

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
const [major, minor, patch] = pkg.version.split(".").map(Number);
const next =
  kind === "major" ? `${major + 1}.0.0` : kind === "minor" ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
execSync("node scripts/sync-version.mjs", { cwd: root, stdio: "inherit" });

const changelog = join(root, "CHANGELOG.md");
const date = new Date().toISOString().slice(0, 10);
const entry = `\n## ${next} — ${date}\n\n- (Décrivez ici les correctifs livrés dans cette version.)\n`;
if (existsSync(changelog)) {
  const current = readFileSync(changelog, "utf-8");
  const marker = "# Journal des versions";
  writeFileSync(changelog, current.replace(marker, marker + "\n" + entry));
} else {
  writeFileSync(changelog, `# Journal des versions\n${entry}`);
}
console.log(`Nouvelle version : ${next} (pensez à documenter les correctifs dans CHANGELOG.md)`);
