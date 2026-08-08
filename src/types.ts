import { Lang } from './i18n';

export interface VersionInfo {
  id: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  url: string;
  time: string;
  releaseTime: string;
}

export interface VersionManifest {
  latest: { release: string; snapshot: string };
  versions: VersionInfo[];
}

export interface DownloadProgress {
  phase: string;
  message: string;
  percent: number;
  current?: number;
  total?: number;
  speed?: number;
  eta?: number;
}

export interface InstalledVersion {
  id: string;
  type: string;
  releaseTime: string;
  hasJar: boolean;
  modCount: number;
  isModded?: boolean;
  parent?: string;
}

export interface ModInfo {
  name: string;
  fileName: string;
  disabled: boolean;
  size: number;
  mtime: number;
}

export interface ScreenshotInfo {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

export interface DownloadQueueTask {
  id: string;
  name: string;
  url: string;
  dest: string;
  status: 'queued' | 'downloading' | 'paused' | 'done' | 'error';
  percent: number;
  speed?: number;
  eta?: number;
  error?: string;
}

export interface FriendInfo {
  id: string;
  name: string;
  ip: string;
  online: boolean;
  lastSeen: number;
  lanOnly?: boolean;
}

export interface LanWorld {
  id: string;
  name: string;
  ip: string;
  port: number;
  lastSeen: number;
}

export interface FriendsSnapshot {
  friends: FriendInfo[];
  lanUsers: FriendInfo[];
  worlds: LanWorld[];
}

export interface ModLoaderVersion {
  version: string;
  stable?: boolean;
  mcversion?: string;
  installerUrl?: string;
}

export interface WorldInfo {
  name: string;
  size: number;
  lastPlayed: number;
  icon: string;
}

export interface ResourcePackInfo {
  name: string;
  size: number;
  isDir: boolean;
}

export interface NewsArticle {
  id: string;
  title: string;
  body: string;
  date: string;
  url: string;
  type: 'release' | 'news';
  image?: string;
}

export interface ModrinthMod {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  downloads: number;
  follows: number;
  categories: string[];
  author: string;
  updated: string;
  projectType?: string;
}

export interface ModrinthVersion {
  id: string;
  name: string;
  version: string;
  mcVersions: string[];
  loaders: string[];
  date: string;
  downloads: number;
  changelog: string;
  files: { name: string; url: string; size: number; primary: boolean }[];
}

export interface ServerInfo {
  id: string;
  name: string;
  address: string;
  port: number;
  history?: { t: number; ms: number }[];
}

export interface ServerStatus {
  online: boolean;
  latency?: number;
  version?: string;
  players?: { online: number; max: number };
  motd?: string;
  error?: string;
}

export interface CrashReport {
  file: string;
  date: string;
  description: string;
  summary: string;
  isOutOfMemory: boolean;
  isModConflict: boolean;
  isDriverIssue: boolean;
}

export interface LaunchValidation {
  java: { valid: boolean; version?: string; major?: number; error?: string };
  version: { valid: boolean; error?: string };
  disk: { valid: boolean; error?: string };
}

export interface AppSettings {
  language: Lang;
  theme: 'dark' | 'light';
  accentColor: string;
  javaPath: string;
  maxMemory: string;
  autoMemory: boolean;
  downloadSource: string;
  modrinthMirror: string;
  downloadThreads: string;
  bandwidthLimit: string;
  autoClose: boolean;
  autoRestart: boolean;
  curseforgeKey: string;
  instanceSettings: Record<string, any>;
  lastKnownVersion: string;
  playTime: Record<string, number>;
  javaScan: any[];
  launchPresets: { name: string; memory: string; jvmArgs: string }[];
  bgImage: string;
  windowWidth: number;
  windowHeight: number;
  lastPlayed: string[];
  accounts: AccountInfo[];
  customGameDirs: Record<string, string>;
  jvmArgs: string;
}

export interface AccountInfo {
  id: string;
  type: 'offline' | 'microsoft' | 'thirdparty';
  username: string;
  uuid: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  active?: boolean;
  serverUrl?: string;
  apiRoot?: string;
  authInjectorPath?: string;
}

interface ElectronAPI {
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  mc: {
    getManifest: () => Promise<VersionManifest>;
    getVersionInfo: (id: string) => Promise<any>;
    downloadVersion: (id: string) => Promise<{ success: boolean }>;
    launch: (id: string) => Promise<{ success: boolean; exitCode: number }>;
    onDownloadProgress: (cb: (data: DownloadProgress) => void) => void;
    onGameLog: (cb: (data: string) => void) => void;
    onGameClosed: (cb: (code: number) => void) => void;
    getInstalledVersions: () => Promise<InstalledVersion[]>;
    deleteVersion: (id: string) => Promise<boolean>;
    openFolder: () => Promise<void>;
    getMods: (versionId: string) => Promise<ModInfo[]>;
    importMod: (versionId: string, sourcePath: string) => Promise<{ name: string; path: string }>;
    importMods: (versionId: string, files: string[]) => Promise<{ success: boolean; name: string; error?: string }[]>;
    deleteMod: (versionId: string, filename: string) => Promise<boolean>;
    getFabricVersions: (mcVersion: string) => Promise<ModLoaderVersion[]>;
    getForgeVersions: (mcVersion: string) => Promise<ModLoaderVersion[]>;
    installFabric: (mcVersion: string, loaderVersion: string) => Promise<{ success: boolean }>;
    installForge: (mcVersion: string, forgeVersion: string) => Promise<{ success: boolean }>;
    getSettings: () => Promise<AppSettings>;
    saveSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>;
    getAccounts: () => Promise<AccountInfo[]>;
    getActiveAccount: () => Promise<AccountInfo | null>;
    setActiveAccount: (id: string) => Promise<void>;
    addOfflineAccount: (username: string) => Promise<AccountInfo>;
    removeAccount: (id: string) => Promise<void>;
    startMicrosoftLogin: () => Promise<AccountInfo>;
    loginThirdParty: (serverUrl: string, username: string, password: string) => Promise<{ success: boolean }>;
    getWorlds: () => Promise<WorldInfo[]>;
    deleteWorld: (name: string) => Promise<boolean>;
    backupWorld: (name: string) => Promise<{ name: string; path: string }>;
    openWorldsFolder: () => Promise<void>;
    getWorldIcon: (name: string) => Promise<string>;
    getResourcePacks: () => Promise<ResourcePackInfo[]>;
    importResourcePacks: (files: string[]) => Promise<{ success: boolean; name: string; error?: string }[]>;
    deleteResourcePack: (name: string) => Promise<boolean>;
    openResourcePacksFolder: () => Promise<void>;
    getOptiFineVersions: (mcVersion: string) => Promise<ModLoaderVersion[]>;
    installOptiFine: (mcVersion: string, optiVersion: string) => Promise<{ success: boolean }>;
    getNeoForgeVersions: (mcVersion: string) => Promise<ModLoaderVersion[]>;
    installNeoForge: (mcVersion: string, version: string) => Promise<{ success: boolean }>;
    getQuiltVersions: (mcVersion: string) => Promise<ModLoaderVersion[]>;
    installQuilt: (mcVersion: string, version: string) => Promise<{ success: boolean }>;
    getCustomGameDirs: () => Promise<Record<string, string>>;
    setCustomGameDir: (versionId: string, dir?: string) => Promise<Record<string, string>>;
    removeCustomGameDir: (versionId: string) => Promise<void>;
    getAutoMemory: () => Promise<string>;
    getVersionChangelog: (versionId: string) => Promise<{ summary: string; url: string } | null>;
    getMinecraftNews: () => Promise<NewsArticle[]>;
    searchModrinth: (query: string, page?: number, projectType?: string) => Promise<{ hits: ModrinthMod[]; total: number }>;
    getModrinthPopular: (projectType?: string) => Promise<{ hits: ModrinthMod[] }>;
    getModrinthMod: (slug: string) => Promise<any>;
    getModrinthVersions: (slug: string, mcVersion?: string, projectType?: string) => Promise<ModrinthVersion[]>;
    downloadMod: (versionId: string, url: string, filename: string, destType?: string) => Promise<{ success: boolean; path: string }>;
    parseModpack: (filePath: string) => Promise<any>;
    installModpack: (pack: any) => Promise<{ success: boolean }>;
    exportModpack: (versionId: string, format: string) => Promise<{ success: boolean; path: string; name: string }>;
    getServers: () => Promise<ServerInfo[]>;
    addServer: (name: string, address: string, port?: number) => Promise<ServerInfo[]>;
    removeServer: (id: string) => Promise<void>;
    pingServer: (id: string, address: string, port?: number) => Promise<ServerStatus>;
    checkCrashReports: () => Promise<CrashReport[]>;
    getCrashSuggestion: (crash: CrashReport) => Promise<string>;
    validateLaunch: (versionId: string) => Promise<LaunchValidation>;
    cloneVersion: (versionId: string, newName: string) => Promise<string>;
    renameVersion: (versionId: string, newName: string) => Promise<string>;
    getInstanceSettings: (versionId: string) => Promise<any>;
    setInstanceSettings: (versionId: string, patch: any) => Promise<any>;
    downloadQueueAdd: (item: any) => Promise<any>;
    downloadQueuePause: (id: string) => Promise<void>;
    downloadQueueResume: (id: string) => Promise<void>;
    downloadQueueCancel: (id: string) => Promise<void>;
    downloadQueueGet: () => Promise<DownloadQueueTask[]>;
    toggleMod: (versionId: string, filename: string) => Promise<{ disabled: boolean }>;
    getModDependencies: (versionId: string) => Promise<{ projectId: string; versionId: string }[]>;
    getModrinthVersionFile: (versionId: string) => Promise<{ name: string; url: string } | null>;
    checkModUpdates: (slugs: string[]) => Promise<{ slug: string; latest: string; latestDate: string }[]>;
    getScreenshots: () => Promise<ScreenshotInfo[]>;
    getScreenshotBase64: (name: string) => Promise<string>;
    deleteScreenshot: (name: string) => Promise<boolean>;
    openScreenshotsFolder: () => Promise<void>;
    checkNewVersion: () => Promise<{ hasNew: boolean; old?: string; latest: string }>;
    getFriendsSnapshot: () => Promise<FriendsSnapshot>;
    addFriend: (name: string, ip: string) => Promise<FriendInfo[]>;
    removeFriend: (id: string) => Promise<void>;
    copyServerAddress: (ip: string, port: number) => Promise<{ success: boolean }>;
    generateInviteCode: () => Promise<string>;
    resolveInviteCode: (code: string) => Promise<{ success: boolean; ip?: string; username?: string; error?: string; friends?: any[] }>;
    checkModsForUpdates: (versionId: string) => Promise<any[]>;
    detectModConflicts: (versionId: string) => Promise<{ base: string; files: string[] }[]>;
    updateAllMods: (versionId: string) => Promise<{ updated: number; failed: number; backupDir: string }>;
    onGameStats: (cb: (data: { type: 'fps' | 'memory'; value: number }) => void) => void;
    searchCurseForge: (query: string, gameVersion?: string) => Promise<any[]>;
    getCurseForgeFiles: (modId: string, gameVersion?: string) => Promise<any[]>;
    checkForUpdates: () => Promise<{ hasUpdate: boolean; current: string; latest?: string; notes?: string; url?: string; assets?: { name: string; url: string; size: number }[] }>;
    getLauncherVersion: () => Promise<string>;
    downloadUpdate: () => Promise<{ success: boolean }>;
    applyUpdate: () => Promise<{ success: boolean; installer?: string; error?: string }>;
    getInstalledJres: () => Promise<{ name: string; dir: string; path: string; exists: boolean }[]>;
    listAdoptium: (major: number) => Promise<{ name: string; version: string; url: string; size: number }[]>;
    installJre: (major: number) => Promise<{ success: boolean }>;
    getModDependencyTree: (slug: string) => Promise<any[]>;
    openUpdateFolder: () => Promise<void>;
    onUpdateProgress: (cb: (data: { percent: number; downloaded: number; total: number }) => void) => void;
    getErrorLog: () => Promise<string>;
    clearErrorLog: () => Promise<void>;
    importMinecraftFolder: (folderPath: string) => Promise<{ success: boolean; name: string; mcVersion: string }>;
    getCrashDetail: (file: string) => Promise<any>;
    scanJava: () => Promise<{ path: string; version: string; major: number }[]>;
    recommendedJava: (mcVersion: string) => Promise<number>;
    runDiagnostics: () => Promise<{ network: { host: string; ok: boolean; ms?: number; error?: string }[]; java: any[] }>;
    autoSelectSource: () => Promise<{ best: string; mojang: number; bmclapi: number }>;
    getPlayTime: () => Promise<Record<string, number>>;
    getDownloadStats: () => Promise<{ totalBytes: number }>;
    savePresets: (presets: any[]) => Promise<void>;
    getInstanceIcon: (versionId: string) => Promise<string>;
    setInstanceIcon: (versionId: string, iconPath: string) => Promise<{ success: boolean; icon: string }>;
    getInstanceBanner: (versionId: string) => Promise<string>;
    setInstanceBanner: (versionId: string, bannerData: string) => Promise<{ success: boolean; banner: string }>;
    setBgImage: (path: string) => Promise<void>;
    getBgImage: () => Promise<string>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
