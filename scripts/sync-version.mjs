// Synchronise shared/version.ts depuis package.json (source unique de vérité).
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const content =
  `// Version générée depuis package.json — NE PAS MODIFIER À LA MAIN.\n` +
  `// Utilisez \`npm run bump -- patch|minor|major\`, ou éditez package.json puis \`npm run sync-version\`.\n` +
  `export const APP_VERSION = "${pkg.version}";\n`;
writeFileSync(join(root, "shared", "version.ts"), content);
console.log(`Version synchronisée : ${pkg.version}`);
