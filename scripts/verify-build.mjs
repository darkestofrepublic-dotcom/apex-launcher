// Vérifie les fichiers produits par la compilation (renderer + main + icône).
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const required = ["dist-renderer/index.html", "dist-main/electron/main.js", "dist-main/electron/preload.js", "dist-main/electron/ipc.js", "assets/icon.ico", "assets/icon.icns", "assets/wizard.bmp", "assets/wizard-small.bmp", "package.json"];
let failed = false;
for (const rel of required) {
  const full = join(root, rel);
  if (!existsSync(full)) {
    console.error(`MANQUANT : ${rel}`);
    failed = true;
  } else {
    console.log(`OK : ${rel} (${statSync(full).size} octets)`);
  }
}
if (failed) {
  console.error("Vérification échouée : lancez 'npm run build'.");
  process.exit(1);
}
console.log("Compilation vérifiée avec succès.");
