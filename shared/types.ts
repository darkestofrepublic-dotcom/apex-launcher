/** Types partagés entre le processus principal et l'interface. */

export type AccountType = "microsoft" | "offline";

export interface Account {
  id: string;
  type: AccountType;
  displayName: string;
  uuid: string;
  avatarPath?: string;
  createdAt: number;
  lastUsedAt: number;
}

export interface MicrosoftAccount extends Account {
  type: "microsoft";
  gamertag?: string;
}

export interface OfflineAccount extends Account {
  type: "offline";
}

export type LoaderType = "vanilla" | "fabric" | "forge" | "neoforge" | "quilt";

export interface Instance {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  minecraftVersion: string;
  loader: LoaderType;
  loaderVersion?: string;
  directory: string;
  memoryMinMb: number;
  memoryMaxMb: number;
  javaPath?: string;
  jvmArgs?: string;
  windowWidth?: number;
  windowHeight?: number;
  fullscreen?: boolean;
  createdAt: number;
  lastPlayedAt?: number;
  playCount: number;
}

export interface LauncherSettings {
  theme: "dark" | "light";
  accentColor: string;
  interfaceScale: number;
  animations: boolean;
  defaultMemoryMinMb: number;
  defaultMemoryMaxMb: number;
  defaultJavaPath?: string;
  defaultJvmArgs?: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultFullscreen: boolean;
  gameDirectory: string;
  backupDirectory: string;
  maxConcurrentDownloads: number;
  bandwidthLimitKbps?: number;
  resumeDownloads: boolean;
  customBanner?: string;
  selectedInstanceId?: string;
  activeAccountId?: string;
  curseforgeApiKey?: string;
  microsoftClientId?: string;
  diagnosticsEnabled: boolean;
  language: "fr" | "en";
  updateFeedUrl?: string;
  checkUpdatesOnStartup: boolean;
  transparency: boolean;
}

export type DownloadStatus =
  | "attente"
  | "cours"
  | "suspendu"
  | "annule"
  | "termine"
  | "echec"
  | "verification"
  | "installation";

export interface DownloadItem {
  id: string;
  label: string;
  url: string;
  destination: string;
  expectedSize?: number;
  sha1?: string;
  downloadedBytes: number;
  status: DownloadStatus;
  speedBps?: number;
  etaSeconds?: number;
  error?: string;
}

export interface McVersionInfo {
  id: string;
  type: "release" | "snapshot" | "old_beta" | "old_alpha";
  url: string;
  releaseTime: string;
  javaVersion?: { component: string; majorVersion: number };
  installed: boolean;
  complete: boolean;
}

export interface InstalledMod {
  fileName: string;
  enabled: boolean;
  size: number;
  projectId?: string;
  versionId?: string;
  versionNumber?: string;
  gameVersions?: string[];
  loaders?: string[];
}

export interface ServerEntry {
  id: string;
  name: string;
  address: string;
  port?: number;
  description?: string;
  category?: string;
  favorite: boolean;
  icon?: string;
  lastPlayedAt?: number;
}

export interface BackupEntry {
  id: string;
  name: string;
  filePath: string;
  size: number;
  createdAt: number;
  kind: "monde" | "configuration" | "instance" | "parametres";
}

export interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
}

export interface HudModule {
  id: string;
  name: string;
  description: string;
  available: boolean;
  enabled: boolean;
  missingDependency?: string;
  x?: number;
  y?: number;
  scale?: number;
  opacity?: number;
  color?: string;
  shortcut?: string;
}

export interface OperationResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}
