/** Configuration centrale du projet — modifiable en un seul endroit. */
import { APP_VERSION } from "./version.js";

export const APP_CONFIG = {
  appName: "Apex Launcher",
  appSlug: "apex-launcher",
  publisher: "ApexDevlabs",
  version: APP_VERSION,
  appId: "com.apexdevlabs.launcher",
  installerFileName: "ApexLauncher-Setup-x64.exe",
  dataDirName: "ApexLauncher",
  supportUrl: "https://github.com/darkestofrepublic-dotcom/apex-launcher",
  updatesFeed: "https://api.github.com/darkestofrepublic-dotcom/apex-launcher/releases/latest",
  mojangVersionManifest: "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
  modrinthApi: "https://api.modrinth.com/v2",
  curseforgeApi: "https://api.curseforge.com/v1",
  fabricMeta: "https://meta.fabricmc.net/v2",
  quiltMeta: "https://meta.quiltmc.org/v3",
  neoforgeMeta: "https://maven.neoforged.net/api/maven",
  forgePromotions: "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
  javaRuntimesManifest: "https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96-52b9-4a55-88c1-ff2fb15b097b/all.json",
  msAuth: {
    authorize: "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
    token: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
    scopes: ["XboxLive.signin", "offline_access", "openid", "profile", "email"],
    redirectUri: "http://localhost:19855/callback",
  },
  xboxAuth: "https://user.auth.xboxlive.com/user/authenticate",
  xstsAuth: "https://xsts.auth.xboxlive.com/xsts/authorize",
  mcLoginXbox: "https://api.minecraftservices.com/authentication/login_with_xbox",
  mcEntitlements: "https://api.minecraftservices.com/entitlements/mcstore",
  mcProfile: "https://api.minecraftservices.com/minecraft/profile",
} as const;

export type AppConfig = typeof APP_CONFIG;
