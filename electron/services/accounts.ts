import { randomUUID, createHash } from "node:crypto";
import { BrowserWindow, safeStorage } from "electron";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import type { Account, OperationResult } from "../../shared/types.js";
import { APP_CONFIG } from "../../shared/config.js";
import { loadJson, saveJson, getDataDir, getLogger } from "./store.js";
import { loadSettings } from "./settings.js";

const ACCOUNTS_FILE = "comptes.json";
const SECRETS_FILE = "secrets.bin";

interface StoredSecrets {
  [accountId: string]: {
    msRefreshToken?: string;
    mcAccessToken?: string;
    expiresAt?: number;
  };
}

function offlineUuid(pseudo: string): string {
  const hash = createHash("md5").update(`HorsLigne:${pseudo}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-3${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function validatePseudo(pseudo: string): string | null {  if (!pseudo || pseudo.length < 3) return "Le pseudonyme doit contenir au moins 3 caractères.";
  if (pseudo.length > 16) return "Le pseudonyme doit contenir 16 caractères maximum.";
  if (!/^[A-Za-z0-9_]+$/.test(pseudo)) return "Lettres, chiffres et traits de soulignement uniquement.";
  return null;
}

// --- Stockage sécurisé (coffre Windows via safeStorage, jamais en clair) ---

function loadSecrets(): StoredSecrets {
  try {
    const file = path.join(getDataDir(), SECRETS_FILE);
    if (!fs.existsSync(file)) return {};
    const encrypted = fs.readFileSync(file);
    if (!safeStorage.isEncryptionAvailable()) return {};
    const json = safeStorage.decryptString(encrypted);
    return JSON.parse(json) as StoredSecrets;
  } catch {
    return {};
  }
}

function saveSecrets(secrets: StoredSecrets): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Le chiffrement du système est indisponible : impossible de stocker des jetons.");
  }
  const file = path.join(getDataDir(), SECRETS_FILE);
  fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(secrets)));
}

// --- Comptes ---

export function listAccounts(): Account[] {
  return loadJson<Account[]>(ACCOUNTS_FILE, []);
}

function persistAccounts(accounts: Account[]): void {
  saveJson(ACCOUNTS_FILE, accounts);
}

export function createOfflineAccount(pseudo: string, avatarPath?: string): OperationResult<Account> {
  const err = validatePseudo(pseudo);
  if (err) return { ok: false, error: err };
  const accounts = listAccounts();
  if (accounts.some((a) => a.displayName.toLowerCase() === pseudo.toLowerCase())) {
    return { ok: false, error: "Un profil porte déjà ce pseudonyme." };
  }
  const account: Account = {
    id: randomUUID(),
    type: "offline",
    displayName: pseudo,
    uuid: offlineUuid(pseudo),
    avatarPath,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  };
  accounts.push(account);
  persistAccounts(accounts);
  getLogger().info("comptes", `Profil hors ligne créé : ${pseudo}`);
  return { ok: true, data: account };
}

export function updateOfflineAccount(id: string, pseudo: string, avatarPath?: string): OperationResult<Account> {
  const err = validatePseudo(pseudo);
  if (err) return { ok: false, error: err };
  const accounts = listAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return { ok: false, error: "Profil introuvable." };
  if (acc.type !== "offline") return { ok: false, error: "Seuls les profils hors ligne peuvent être renommés ici." };
  acc.displayName = pseudo;
  acc.uuid = offlineUuid(pseudo);
  if (avatarPath !== undefined) acc.avatarPath = avatarPath;
  persistAccounts(accounts);
  return { ok: true, data: acc };
}

export function removeAccount(id: string): OperationResult {
  const accounts = listAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return { ok: false, error: "Profil introuvable." };
  persistAccounts(accounts.filter((a) => a.id !== id));
  // Purge des secrets associés (révocation locale immédiate).
  try {
    const secrets = loadSecrets();
    delete secrets[id];
    saveSecrets(secrets);
  } catch {
    /* si le coffre est indisponible, les jetons chiffrés restants sont inutilisables sans la clé */
  }
  getLogger().info("comptes", `Profil supprimé : ${acc.displayName} (données de jeu conservées)`);
  return { ok: true };
}

export function setActiveAccount(id: string): OperationResult<Account> {
  const accounts = listAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return { ok: false, error: "Profil introuvable." };
  acc.lastUsedAt = Date.now();
  persistAccounts(accounts);
  const settings = loadSettings();
  saveJson("parametres.json", { ...settings, activeAccountId: id });
  return { ok: true, data: acc };
}

export function getActiveAccount(): Account | null {
  const accounts = listAccounts();
  const settings = loadSettings();
  return accounts.find((a) => a.id === settings.activeAccountId) ?? accounts[0] ?? null;
}

// --- Authentification Microsoft (flux officiel, aucun mot de passe collecté) ---

function getClientId(): string {
  return loadSettings().microsoftClientId?.trim() || process.env.MICROSOFT_CLIENT_ID || "";
}

/** Un client ID Azure est un GUID (8-4-4-4-12 hexadécimal). */
export function validateClientId(id: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test((id ?? "").trim());
}

/** Codes d'erreur stables pour l'interface (bilingue côté renderer). */
export const MS_ERRORS = {
  NOT_CONFIGURED: "ERR_MS_NOT_CONFIGURED",
  INVALID_ID: "ERR_MS_INVALID_ID",
  TIMEOUT: "ERR_MS_TIMEOUT",
  CANCELLED: "ERR_MS_CANCELLED",
  APP_NOT_FOUND: "ERR_MS_APP_NOT_FOUND",
  REDIRECT_MISMATCH: "ERR_MS_REDIRECT_MISMATCH",
  NO_MINECRAFT: "ERR_MS_NO_MINECRAFT",
} as const;

/** Mappe les erreurs Azure AD (AADSTSxxxx) vers des codes stables et exploitables. */
export function mapAadstsError(message: string): string | null {
  const m = message.match(/AADSTS(\d+)/);
  if (!m) return null;
  const code = m[1];
  if (code === "700016" || code === "7000215" || code === "7000222") return MS_ERRORS.APP_NOT_FOUND;
  if (code === "50011" || code === "500113") return MS_ERRORS.REDIRECT_MISMATCH;
  return null;
}

export function microsoftStatus(): { configured: boolean; hint: string } {
  const configured = getClientId().length > 0;
  return {
    configured,
    hint: configured
      ? "Connexion Microsoft disponible."
      : "Configurez un client ID Azure (Paramètres > Comptes) pour activer la connexion Microsoft. Sans cela, seuls les profils hors ligne sont disponibles.",
  };
}

async function postForm<T>(url: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Authentification refusée (HTTP ${res.status}). ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function listenForCode(expectedState: string): { promise: Promise<string>; cancel: (reason: Error) => void } {
  let rejectFn: (e: Error) => void = () => {};
  let settled = false;
  const promise = new Promise<string>((resolve, reject) => {
    rejectFn = (e) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    };
    const server = http.createServer((req, res) => {
      const done = (fn: () => void) => {
        if (!settled) {
          settled = true;
          try {
            server.close();
          } catch {
            /* déjà fermé */
          }
          fn();
        }
      };
      try {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (url.pathname === "/callback") {
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const err = url.searchParams.get("error_description") ?? url.searchParams.get("error");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<html><body style='font-family:sans-serif;background:#0f1420;color:#fff;padding:40px'>" +
              "<h2>Connexion réussie</h2><p>Vous pouvez fermer cette fenêtre et revenir dans Apex Launcher.</p></body></html>",
          );
          if (err) done(() => reject(new Error(`Connexion annulée : ${err}`)));
          else if (!code || state !== expectedState) done(() => reject(new Error("Réponse d'authentification invalide.")));
          else done(() => resolve(code));
        } else {
          res.writeHead(404);
          res.end();
        }
      } catch (e) {
        done(() => reject(e as Error));
      }
    });
    server.listen(19855, "127.0.0.1");
    server.on("error", (e) => {
      if (!settled) {
        settled = true;
        reject(e as Error);
      }
    });
    setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          server.close();
        } catch {
          /* ignore */
        }
        reject(new Error(MS_ERRORS.TIMEOUT));
      }
    }, 5 * 60 * 1000).unref();
  });
  return { promise, cancel: rejectFn };
}

export async function startMicrosoftLogin(parent: BrowserWindow | null): Promise<OperationResult<Account>> {
  const log = getLogger();
  const clientId = getClientId();
  if (!clientId) {
    return { ok: false, error: MS_ERRORS.NOT_CONFIGURED };
  }
  if (!validateClientId(clientId)) {
    return { ok: false, error: MS_ERRORS.INVALID_ID };
  }
  const state = randomUUID();
  const authUrl =
    `${APP_CONFIG.msAuth.authorize}?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(APP_CONFIG.msAuth.redirectUri)}` +
    `&scope=${encodeURIComponent(APP_CONFIG.msAuth.scopes.join(" "))}&state=${encodeURIComponent(state)}&prompt=select_account`;

  const win = new BrowserWindow({
    width: 520,
    height: 680,
    title: "Connexion Microsoft",
    parent: parent ?? undefined,
    modal: false,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  void win.loadURL(authUrl);
  log.info("auth", "Fenêtre de connexion Microsoft ouverte (aucun mot de passe collecté par le launcher).");

  const listener = listenForCode(state);
  let finished = false;
  win.on("closed", () => {
    if (!finished) listener.cancel(new Error(MS_ERRORS.CANCELLED));
  });

  try {
    const code = await listener.promise;
    finished = true;
    if (!win.isDestroyed()) win.close();

    const token = await postForm<{ access_token: string; refresh_token: string; expires_in: number }>(APP_CONFIG.msAuth.token, {
      client_id: clientId,
      code,
      grant_type: "authorization_code",
      redirect_uri: APP_CONFIG.msAuth.redirectUri,
    });

    const account = await completeXboxChain(token.access_token, token.refresh_token, token.expires_in);
    return { ok: true, data: account };
  } catch (err) {
    finished = true;
    if (!win.isDestroyed()) win.close();
    const raw = err instanceof Error ? err.message : "Échec de la connexion Microsoft.";
    const mapped = mapAadstsError(raw) ?? (Object.values(MS_ERRORS).includes(raw as never) ? raw : null);
    const message = mapped ?? raw;
    log.error("auth", `Échec connexion Microsoft : ${raw}`);
    return { ok: false, error: message };
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Identifiants Xbox refusés. Vérifiez le compte puis réessayez.");
    throw new Error(`Service Xbox/Minecraft indisponible (HTTP ${res.status}). ${text.slice(0, 160)}`);
  }
  return (await res.json()) as T;
}

async function completeXboxChain(msAccessToken: string, msRefreshToken: string, expiresIn: number): Promise<Account> {
  // 1. Xbox Live
  const xbl = await postJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>(APP_CONFIG.xboxAuth, {
    Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${msAccessToken}` },
    RelyingParty: "http://auth.xboxlive.com",
    TokenType: "JWT",
  });
  const uhs = xbl.DisplayClaims.xui[0].uhs;

  // 2. XSTS
  const xsts = await postJson<{ Token: string }>(APP_CONFIG.xstsAuth, {
    Properties: { SandboxId: "RETAIL", UserTokens: [xbl.Token] },
    RelyingParty: "rp://api.minecraftservices.com/",
    TokenType: "JWT",
  });

  // 3. Minecraft
  const mc = await postJson<{ access_token: string; expires_in: number }>(APP_CONFIG.mcLoginXbox, {
    identityToken: `XBL3.0 x=${uhs};${xsts.Token}`,
  });

  // 4. Vérification de propriété du jeu (ne jamais contourner)
  const ent = await fetch(APP_CONFIG.mcEntitlements, { headers: { Authorization: `Bearer ${mc.access_token}` } });
  if (!ent.ok) throw new Error("Impossible de vérifier la possession de Minecraft.");
  const entJson = (await ent.json()) as { items?: unknown[] };
  if (!entJson.items?.length) {
    throw new Error(MS_ERRORS.NO_MINECRAFT);
  }

  // 5. Profil
  const profileRes = await fetch(APP_CONFIG.mcProfile, { headers: { Authorization: `Bearer ${mc.access_token}` } });
  if (!profileRes.ok) throw new Error("Profil Minecraft introuvable pour ce compte.");
  const profile = (await profileRes.json()) as { id: string; name: string };

  const accounts = listAccounts();
  let account = accounts.find((a) => a.type === "microsoft" && a.uuid === profile.id);
  if (!account) {
    account = {
      id: randomUUID(),
      type: "microsoft",
      displayName: profile.name,
      uuid: profile.id,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    } as Account;
    accounts.push(account);
  } else {
    account.displayName = profile.name;
    account.lastUsedAt = Date.now();
  }
  persistAccounts(accounts);

  const secrets = loadSecrets();
  secrets[account.id] = {
    msRefreshToken,
    mcAccessToken: mc.access_token,
    expiresAt: Date.now() + Math.min(expiresIn, mc.expires_in) * 1000,
  };
  saveSecrets(secrets);
  getLogger().info("auth", `Compte Microsoft connecté : ${profile.name} (jetons chiffrés dans le coffre système)`);
  return account;
}

export async function refreshMicrosoftAccount(id: string): Promise<OperationResult<Account>> {
  const clientId = getClientId();
  if (!clientId) return { ok: false, error: "Client ID Azure manquant." };
  const secrets = loadSecrets();
  const stored = secrets[id];
  if (!stored?.msRefreshToken) return { ok: false, error: "Session expirée : reconnectez-vous." };
  try {
    const token = await postForm<{ access_token: string; refresh_token: string; expires_in: number }>(APP_CONFIG.msAuth.token, {
      client_id: clientId,
      refresh_token: stored.msRefreshToken,
      grant_type: "refresh_token",
    });
    const account = await completeXboxChain(token.access_token, token.refresh_token, token.expires_in);
    return { ok: true, data: account };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Actualisation impossible.";
    return { ok: false, error: mapAadstsError(raw) ?? raw };
  }
}

export function logoutMicrosoft(id: string): OperationResult {
  try {
    const secrets = loadSecrets();
    delete secrets[id];
    saveSecrets(secrets);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Déconnexion impossible." };
  }
}

/** Jeton d'accès Minecraft pour le lancement (actualisé si nécessaire). */
export async function getMinecraftAccessToken(account: Account): Promise<{ token: string; uuid: string } | null> {
  if (account.type === "offline") return { token: "0", uuid: account.uuid };
  const secrets = loadSecrets();
  const stored = secrets[account.id];
  if (!stored?.mcAccessToken) return null;
  if (stored.expiresAt && stored.expiresAt - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshMicrosoftAccount(account.id);
    if (!refreshed.ok || !refreshed.data) return null;
    const updated = loadSecrets()[account.id];
    if (!updated?.mcAccessToken) return null;
    return { token: updated.mcAccessToken, uuid: account.uuid };
  }
  return { token: stored.mcAccessToken, uuid: account.uuid };
}

export function getAvatarsDir(): string {
  return path.join(getDataDir(), "avatars");
}
