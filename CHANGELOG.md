# Journal des versions

## 1.0.7 — 2026-10-14

- Nouveau logo APEX (sommet + diamant) dans l'application, l'installateur et l'exécutable (ICO, ICNS macOS, PNG Linux régénérés).
- Écran de démarrage avec logo, version et barre de progression (fenêtre dédiée, fermeture automatique).
- Page Assistance : FAQ bilingue, dépannage (diagnostic, dossier de données, infos système), liens utiles.
- Optimisations : pages en chargement différé (12 paquets séparés), progression des téléchargements isolée (plus de re-rendus globaux).
- Builds multi-OS configurés (Windows x64 Inno, macOS x64+ARM64 dmg/zip, Linux x64+ARM64 AppImage/deb) via GitHub Actions sur tags `v*`.
- Dépôt public prêt : LICENSE MIT, CI (typecheck/tests/build sur 3 OS), workflow de release automatique.


## 1.0.6 — 2026-10-14

- Interrupteur de transparence (Paramètres > Apparence) : verre en temps réel, fond uni sinon.
- Vrai switch sombre/clair avec icônes lune/soleil (fini le menu déroulant).
- Thème sombre réellement neutre : surfaces grises, aurores désaturées, plus de teinte bleue.


## 1.0.5 — 2026-10-14

- Vrai verre : fenêtre Electron transparente — le fond d'écran et les applications derrière transparaissent à travers les panneaux ; fond uni supprimé, flou sur la barre de titre et le journal.
- Finitions professionnelles : indicateur actif dans la navigation, survol des tableaux, anneaux de focus clavier, marque et hero affinés, textures adoucies.


## 1.0.4 — 2026-10-14

- Thème « Liquid Glass » sur toute l'application : surfaces translucides, flou, reflets, barre latérale flottante.
- Galeries d'images : couvertures des modpacks et mods (galerie Modrinth, visuels FTB, logos CurseForge) avec repli élégant.
- Onglet Shaders dans la Bibliothèque : mods et shaders gérés séparément (activation, suppression, recherche avec aperçus, dossiers dédiés).
- Page Skins : import de skins PNG validés (64×64/64×32), aperçu 2D + tête pixelisée, installation automatique du véritable CustomSkinLoader (Modrinth, version compatible) et dépôt du skin dans LocalSkin/skins sur chaque instance moddée — y compris à la création.


## 1.0.3 — 2026-10-14

- Suggestions automatiques à l'ouverture : Modpacks, Contenu et navigateur de mods affichent la sélection populaire sans recherche préalable (comme les pages d'accueil des sites de modpacks).
- Listes déroulantes intelligentes : position fixe (jamais rognées), ouverture vers le haut quand la place manque, repositionnement au défilement.


## 1.0.2 — 2026-10-14

- Fenêtre sans bordure avec barre de titre personnalisée (contrôles réduire/agrandir/fermer en haut à droite) et style affiné.
- Listes déroulantes 100 % personnalisées dans toute l'interface (recherche intégrée, plus aucun sélecteur natif).
- Java automatique par version : détection, téléchargement du runtime Mojang adapté au lancement, chemin mémorisé par instance.
- Mise à jour en un clic : téléchargement puis exécution automatique de l'installateur (le launcher se ferme et l'installation s'applique).
- Bibliothèque de modpacks (Modrinth, FTB, CurseForge avec clé) avec installation dans une instance dédiée ; import des packs CurseForge (.zip + manifest).
- Navigateur de mods intégré à la page Bibliothèque : recherche filtrée par version/chargeur de l'instance et installation directe.
- Désinstallation silencieuse non bloquante.


## 1.0.1 — 2026-10-13

- Correction de l'écran vide au démarrage : le script preload est désormais compilé en CommonJS (exigé par le sandbox Electron) ; ajout d'un message d'erreur explicite si le pont IPC est indisponible.
- Icône Windows multi-tailles au format BMP (compatibilité rcedit maximale).
- Refonte professionnelle de l'interface : jeu d'icônes SVG original (plus d'emojis), thème sobre, pilules de statut, panneau de lancement.
- Application bilingue français/anglais (détection de la langue du système, sélecteur dans Paramètres) ; installateur bilingue (sélection automatique selon Windows).
- Mises à jour intégrées : vérification au démarrage et dans Paramètres, téléchargement du programme d'installation avec progression réelle.
- Versionnage systématique : version unique dans `package.json` (`npm run bump -- patch|minor|major`), `CHANGELOG.md` tenu à jour.
- Désinstallation silencieuse non bloquante (message de conservation des données réservé au mode interactif).

## 1.0.0 — 2026-10-13

- Version initiale : launcher complet (comptes Microsoft/hors ligne, versions Mojang, Fabric/Quilt, instances, Modrinth, Java automatique, serveurs, mods, sauvegardes, diagnostic) et installateur Windows `ApexLauncher-Setup-x64.exe`.
