import { create } from 'zustand';

export interface DownloadTask {
  id: string;
  name: string;
  phase: string;
  percent: number;
  speed?: number;
  eta?: number;
  status: 'queued' | 'downloading' | 'paused' | 'done' | 'error';
  error?: string;
}

interface AppState {
  lang: string;
  theme: string;
  accentColor: string;
  manifest: any;
  installedList: any[];
  installedSet: Set<string>;
  downloading: string | null;
  launching: string | null;
  downloadProgress: any;
  toasts: { id: number; type: 'success' | 'error' | 'warning'; message: string }[];
  downloadQueue: DownloadTask[];
  activePage: string;

  setLang: (l: string) => void;
  setTheme: (t: string) => void;
  setAccent: (c: string) => void;
  setManifest: (m: any) => void;
  setInstalled: (list: any[]) => void;
  setDownloading: (v: string | null) => void;
  setLaunching: (v: string | null) => void;
  setDownloadProgress: (p: any) => void;
  pushToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  removeToast: (id: number) => void;
  setActivePage: (p: string) => void;
  addDownloadTask: (t: DownloadTask) => void;
  updateDownloadTask: (id: string, patch: Partial<DownloadTask>) => void;
  removeDownloadTask: (id: string) => void;
}

let toastId = 0;

export const useAppStore = create<AppState>((set) => ({
  lang: 'zh-CN',
  theme: 'dark',
  accentColor: '#6366f1',
  manifest: null,
  installedList: [],
  installedSet: new Set(),
  downloading: null,
  launching: null,
  downloadProgress: null,
  toasts: [],
  downloadQueue: [],
  activePage: 'home',

  setLang: (lang) => set({ lang }),
  setTheme: (theme) => set({ theme }),
  setAccent: (accentColor) => set({ accentColor }),
  setManifest: (manifest) => set({ manifest }),
  setInstalled: (installedList) => set({ installedList, installedSet: new Set(installedList.map((v: any) => v.id)) }),
  setDownloading: (downloading) => set({ downloading }),
  setLaunching: (launching) => set({ launching }),
  setDownloadProgress: (downloadProgress) => set({ downloadProgress }),
  pushToast: (message, type = 'success') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setActivePage: (activePage) => set({ activePage }),
  addDownloadTask: (t) => set((s) => ({ downloadQueue: [...s.downloadQueue, t] })),
  updateDownloadTask: (id, patch) => set((s) => ({ downloadQueue: s.downloadQueue.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
  removeDownloadTask: (id) => set((s) => ({ downloadQueue: s.downloadQueue.filter((t) => t.id !== id) })),
}));
