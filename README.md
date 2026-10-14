# Apex Launcher — par ApexDevlabs

[![CI](https://github.com/apexdevlabs/apex-launcher/actions/workflows/ci.yml/badge.svg)](https://github.com/apexdevlabs/apex-launcher/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/apexdevlabs/apex-launcher)](https://github.com/apexdevlabs/apex-launcher/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Launcher Minecraft Java Edition moderne : gestion des instances, versions officielles,
chargeurs de mods, contenus Modrinth/CurseForge/FTB, comptes Microsoft et profils hors ligne, Java automatique,
skins, sauvegardes, diagnostic — avec de véritables installateurs par système.

## Téléchargements

| Système | Fichier | Provenance |
|---|---|---|
| Windows 10/11 x64 | `ApexLauncher-Setup-x64.exe` | Compilé localement (`npm run installer`) ou onglet Releases GitHub |
| macOS x64 + ARM64 | `.dmg` / `.zip` | Releases GitHub (compilé par CI sur macOS, tags `v*`) |
| Linux x64 + ARM64 | `.AppImage` / `.deb` | Releases GitHub (compilé par CI sur Ubuntu, tags `v*`) |

32 bits : non fourni (les versions modernes d'Electron ne le distribuent plus pour cette stack).
Mobile (Android/iOS) : pas de version prévue — Minecraft Java Edition exige un système desktop
(Windows/macOS/Linux) avec un Java desktop ; un téléphone ne peut pas l'exécuter. Le launcher reste desktop.

> Identité centralisée : le nom (`Apex Launcher`), l'éditeur (`ApexDevlabs`) et la version sont définis dans
> `shared/config.ts` et `package.json`. Modifiez ces deux endroits pour renommer le produit.
>
> **Version** : source unique = `package.json`, synchronisée vers `shared/version.ts` (`npm run sync-version`,
> exécuté automatiquement avant chaque build). Règle du projet : **chaque correctif livré augmente la version** :
> `npm run bump -- patch|minor|major` (met à jour `package.json`, `shared/version.ts` et `CHANGELOG.md`).
> L'installateur et l'onglet Paramètres > Mises à jour lisent toujours cette version.

## Langues

L'interface est disponible en **français** (défaut) et en **anglais**. Au premier démarrage, la langue du système
est détectée (anglais si Windows est en anglais, sinon français) ; elle est modifiable à tout moment dans
Paramètres > Langue, avec effet immédiat. L'installateur Windows est lui aussi bilingue (sélection automatique
selon Windows, sans boîte de dialogue).
Limite connue : quelques messages d'erreur techniques émis par le processus principal restent en français.

## Prérequis

- Windows 10 ou 11, 64 bits.
- Node.js 20+ et npm (pour compiler).
- [Inno Setup 6](https://jrsoftware.org/isdl.php) (pour l'installateur) : `winget install --id JRSoftware.InnoSetup -e`.
- Une connexion Internet pour télécharger Minecraft, les mods et Java.
- Un compte Minecraft Java Edition (Microsoft) pour jouer aux versions officielles en ligne.

## Installation des dépendances

```powershell
npm run install:deps
# ou : npm install
```

## Lancement en développement

```powershell
npm run dev
```

Cela démarre Vite (:5173), la compilation du processus principal en surveillé, puis Electron.
Les données de développement sont stockées dans `%APPDATA%\ApexLauncher`
(ou `APEX_DATA_DIR` si la variable d'environnement est définie).

## Vérification des types et tests

```powershell
npm run typecheck
npm test
```

Les tests couvrent : masquage des secrets dans les journaux, sécurité des chemins d'archives (anti zip-slip),
validation mémoire/RAM, paramètres, compatibilité des chargeurs, pseudonymes, diagnostic de crash,
conflits de mods et choix de version Modrinth compatible.

## Compilation

```powershell
npm run build    # renderer (Vite) + processus principal (tsc) + icônes
npm run verify   # vérifie les fichiers produits
```

## Génération de l'installateur

```powershell
npm run installer
```

Le script `scripts/build-installer.ps1` effectue : compilation → `electron-builder --dir`
(`release\win-unpacked\`) → icône + métadonnées de version via `rcedit` officiel
(`signAndEditExecutable=false` : l'outil `winCodeSign` d'electron-builder exige des privilèges
de liens symboliques indisponibles sans admin ; le résultat est identique) →
compilation Inno Setup → **`release\ApexLauncher-Setup-x64.exe`**.

L'installateur (français) : installe les fichiers compilés, propose les raccourcis menu Démarrer/bureau,
permet de lancer l'application, et **conserve par défaut** `%APPDATA%\ApexLauncher`
(mondes, instances, sauvegardes, paramètres) lors de la désinstallation et des mises à niveau.

> **Signature** : l'installateur est construit **non signé** (statut affiché à la fin du script).
> Pour signer : `signtool sign /fd SHA256 /a release\ApexLauncher-Setup-x64.exe` avec un certificat
> Authenticode valide. Aucune fausse signature n'est créée.

## Variables d'environnement et clés API

Copiez `.env.example` vers `.env` (fichier local, non versionné) :

| Variable | Usage |
|---|---|
| `CURSEFORGE_API_KEY` | Catalogue CurseForge (obligatoire pour CurseForge ; à obtenir sur console.curseforge.com). Peut aussi être saisie dans Paramètres > Contenu. |
| `MICROSOFT_CLIENT_ID` | Connexion Microsoft (voir ci-dessous). Peut aussi être saisi dans Paramètres > Comptes. |
| `APEX_DATA_DIR` | Dossier de données personnalisé (défaut : `%APPDATA%\ApexLauncher`). |

Aucun secret n'est versionné ni affiché dans les journaux (masquage automatique).

## Comptes

### Comptes Microsoft

1. Créez une application sur https://portal.azure.com (comptes personnels pris en charge,
   URI de redirection `http://localhost:19855/callback`, autorisez `XboxLive.signin` + `offline_access`).
2. Copiez le **client ID** dans Paramètres > Comptes (ou `.env`).
3. Cliquez sur « Se connecter avec Microsoft » : la connexion s'effectue dans une fenêtre
   officielle Microsoft — **le launcher ne collecte jamais votre mot de passe**.
4. Le launcher vérifie la **possession de Minecraft Java Edition** avant d'autoriser le lancement.
   Sans jeu possédé, la connexion est refusée (aucun contournement).
5. Les jetons sont chiffrés via le coffre Windows (`safeStorage`), jamais en clair.

Sans client ID configuré, la connexion Microsoft est désactivée avec un message explicatif
(état honnête, pas de simulation).

### Profils hors ligne

Création d'un pseudonyme local (3–16 caractères), avatar local, sélection rapide.
Présentés explicitement comme « Hors ligne » : solo, réseau local et serveurs qui l'autorisent.
Aucun jeton fabriqué, aucune usurpation d'identité.

## Fonctionnalités

- **Versions** : manifestes Mojang officiels, installation/vérification (client, bibliothèques, natives, assets, SHA-1), reprise et annulation.
- **Java automatique par version** : à chaque lancement, le Java requis (8/16/17/21) est détecté, téléchargé depuis les sources officielles Mojang si besoin, puis mémorisé pour l'instance.
- **Bibliothèque de modpacks** (page Modpacks) : Modrinth, FTB (API publique, fichiers client uniquement) et CurseForge (clé API requise, choix de version, import du manifest) — chaque pack est installé dans une instance dédiée. Les suggestions populaires s'affichent dès l'ouverture, sans recherche.
- **Navigateur de mods intégré** : dans Bibliothèque, recherche filtrée par version et chargeur de l'instance sélectionnée, installation directe dans son dossier `mods`.
- **Shaders** : onglet dédié dans Bibliothèque (activation/désactivation, suppression, recherche avec aperçus) ; les fichiers vont dans `shaderpacks` (lecture par Iris/Oculus).
- **Skins** (page Skins) : import de PNG 64×64/64×32 validés, aperçu 2D et tête pixelisée, installation automatique du mod CustomSkinLoader officiel (version compatible jeu + chargeur, depuis Modrinth) et dépôt du skin dans `LocalSkin/skins/<pseudo>.png` sur chaque instance moddée, y compris à la création. Aucune configuration fabriquée : le mod utilise ses réglages par défaut documentés. Visible en solo et en LAN.
- **Chargeurs** : Vanilla, Fabric, Quilt (installation réelle). Forge/NeoForge : versions listées, installation automatique complète à venir (message explicite, pas de faux support).
- **Instances** : création, duplication, renommage, paramètres mémoire/Java, ouverture du dossier réel, export/import `.mrpack`, sauvegardes, suppression avec confirmation.
- **Contenus** : recherche Modrinth réelle (mods, modpacks, resource packs, shaders, data packs) avec sélection de version **compatible** ; CurseForge via clé API officielle.
- **Mods** : activation/désactivation, suppression, détection de doublons, dossier réel.
- **Java** : détection, sélection manuelle, téléchargement de runtimes officiels Mojang selon la version de Minecraft (8/16/17/21).
- **Serveurs** : favoris, copie d'adresse, lancement avec `--server`. Les profils hors ligne ne sont jamais présentés comme authentifiés.
- **Modules/HUD** : seuls les modules réellement disponibles sont activables (`Durée de jeu`, `Performances`) ; les autres affichent honnêtement la dépendance manquante (mod « ApexHUD » à venir).
- **Journaux** : launcher, téléchargements, sortie du jeu, diagnostic de crash prudent, export de diagnostic avec secrets masqués.
- **Sécurité** : `contextIsolation` activé, `nodeIntegration` désactivé, API IPC limitée et typée, anti zip-slip, aucune exécution automatique de scripts téléchargés.

## Mises à jour

Apex Launcher vérifie les mises à jour au démarrage (désactivable dans Paramètres > Mises à jour) et à la demande.
Le flux par défaut (`shared/config.ts` → `updatesFeed`) pointe vers les releases GitHub du projet ; l'URL est
modifiable dans les paramètres. Si une version plus récente existe, une bannière s'affiche avec deux options :
télécharger le programme d'installation (progression réelle), ou **télécharger et installer** : le launcher
télécharge l'installateur, l'exécute en mode silencieux et se ferme pour le laisser travailler — aucune
manipulation manuelle requise.
Si le dépôt n'existe pas encore ou est injoignable, un message l'indique honnêtement au lieu d'affirmer un succès.

## Résultats de validation (environnement Windows 10 x64, 14/10/2026, v1.0.7)

- `npm run typecheck` : succès (renderer + processus principal + preload).
- `npm test` : **46/46 tests réussis**.
- Splash vérifié (cible dédiée avec logo/version, fermeture automatique), logo dans la sidebar, page Assistance (5 FAQ + 4 liens), paquets différés (12 chunks), zéro erreur.

- `npm run typecheck` : succès (renderer + processus principal + preload).
- `npm test` : **37/37 tests réussis** (secrets, zip-slip, mémoire, paramètres, chargeurs, pseudos, diagnostic, mods, Modrinth, parité FR/EN, semver, synchronisation de version, mappage FTB, garde-fous auto-update).
- `npm run build` + `npm run verify` : succès.
- Interface vérifiée via débogage distant Chromium : barre de titre custom (3 boutons, zone de drag), 11 entrées de nav, **0 sélecteur natif**, page Modpacks (3 sources), rendu FR + EN, zéro erreur console.
- Installateur : installation/désinstallation silencieuses OK avec conservation de `%APPDATA%\ApexLauncher` ; désinstallation silencieuse non bloquante (1,2 s).
- Démarrage Electron : fenêtre « Apex Launcher » chargée (vérifié via débogage distant Chromium).
- Installateur `release\ApexLauncher-Setup-x64.exe` (82,5 Mo, SHA-256 dans le log de build) : installation silencieuse OK,
  application installée démarre et affiche l'interface, désinstallation silencieuse OK avec **conservation de
  `%APPDATA%\ApexLauncher`** (vérifiée par marqueur).
- Installateur **non signé** (`Get-AuthenticodeSignature` : `NotSigned`) ; métadonnées de l'exécutable appliquées
  (ApexDevlabs, Apex Launcher, 1.0.0).
- API réelles vérifiées : manifeste Mojang (919 versions), Fabric, Quilt, recherche Modrinth.

## Limites connues

- Fenêtre transparente : nécessite la composition du bureau Windows (DWM, actif par défaut sur Windows 10/11). Sans composition (RDP basique, machines virtuelles sans accélération), la fenêtre peut apparaître opaque. Le flou d'arrière-plan repose sur le floutage du contenu de l'application ; Windows ne fournit pas de flou du bureau sans pilote dédié.

- Installation automatique complète de Forge/NeoForge : à venir (versions listées, message explicite).
- Mod d'accompagnement « ApexHUD » (modules HUD dans le jeu) : à développer sous licence compatible.
- Catalogue CurseForge : nécessite une clé API personnelle ; certains fichiers peuvent exiger un passage sur le site du fournisseur (expliqué à l'utilisateur).
- Connexion Microsoft : nécessite un client ID Azure personnel (gratuit).
- Installateur : non signé par défaut (Windows SmartScreen peut afficher un avertissement — normal pour un logiciel non signé).

## Dépannage

- **Le jeu ne démarre pas** : page Java → « Vérifier et préparer » ; page Captures et journaux → sortie du jeu et diagnostic.
- **Téléchargement bloqué** : annulez puis réessayez ; vérifiez l'espace disque et la connexion.
- **Session Microsoft expirée** : bouton « Actualiser » sur la carte du compte, ou reconnectez-vous.
- **Données corrompues** : le launcher sauvegarde le fichier en `.corrompu-<date>.bak` au lieu de le supprimer.
- **Rapport technique** : Captures et journaux → « Exporter le diagnostic » (secrets masqués).

## Structure du projet

```
electron/          processus principal (main, preload, IPC)
  services/        authentification, instances, versions, java, téléchargements,
                   contenus (Modrinth/CurseForge), chargeurs, mods, modpacks,
                   serveurs, sauvegardes, HUD, paramètres, stockage, journaux
src/               interface React + TypeScript (français)
shared/            configuration centrale, types et canaux IPC partagés
installer/         script Inno Setup (apex-launcher.iss)
scripts/           icônes, installateur, vérification du build
tests/             tests Vitest (+ simulation du module Electron)
assets/            icon.svg / icon.ico (générés localement)
release/           fichiers produits (win-unpacked/, ApexLauncher-Setup-x64.exe)
```

## Licence

MIT — © 2026 ApexDevlabs. Ni Mojang ni Microsoft ne sont affiliés à ce projet.
« Minecraft » est une marque de Mojang Synergies AB.
