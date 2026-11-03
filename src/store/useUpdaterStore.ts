import { create } from 'zustand';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { isTauriEnvironment } from '@/lib/tauri';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error';

interface UpdaterState {
  status: UpdateStatus;
  availableVersion: string | null;
  currentVersion: string | null;
  releaseDate: string | null;
  releaseNotes: string | null;
  downloadProgress: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  errorMessage: string | null;
  isDismissed: boolean;
  currentUpdate: Update | null;

  checkForUpdates: (silent?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  relaunchApp: () => Promise<void>;
  dismissUpdate: () => void;
}

export const useUpdaterStore = create<UpdaterState>((set, get) => ({
  status: 'idle',
  availableVersion: null,
  currentVersion: null,
  releaseDate: null,
  releaseNotes: null,
  downloadProgress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  errorMessage: null,
  isDismissed: false,
  currentUpdate: null,

  checkForUpdates: async (silent = false) => {
    if (!isTauriEnvironment()) {
      if (!silent) {
        set({
          status: 'error',
          errorMessage: "Les mises à jour sont disponibles uniquement dans l'application native.",
        });
      }
      return;
    }

    const currentStatus = get().status;
    if (currentStatus === 'downloading' || currentStatus === 'ready') {
      return;
    }

    set({ status: 'checking', errorMessage: null, isDismissed: false });

    try {
      const update = await check();
      if (update) {
        set({
          status: 'available',
          availableVersion: update.version,
          currentVersion: update.currentVersion,
          releaseDate: update.date ?? null,
          releaseNotes: update.body ?? null,
          currentUpdate: update,
          isDismissed: false,
        });
      } else {
        set({
          status: 'up-to-date',
          currentUpdate: null,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[Updater] Erreur lors de la vérification:', msg);
      if (!silent) {
        set({
          status: 'error',
          errorMessage: msg || 'Impossible de vérifier les mises à jour.',
        });
      } else {
        set({ status: 'idle' });
      }
    }
  },

  downloadAndInstall: async () => {
    const { currentUpdate, status } = get();
    if (!currentUpdate || status === 'downloading') return;

    set({
      status: 'downloading',
      downloadProgress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      errorMessage: null,
    });

    try {
      let downloaded = 0;
      let total = 0;

      await currentUpdate.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0;
          set({ totalBytes: total });
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          const progress = total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
          set({
            downloadedBytes: downloaded,
            downloadProgress: progress,
          });
        } else if (event.event === 'Finished') {
          set({ downloadProgress: 100, status: 'ready' });
        }
      });

      set({ status: 'ready', downloadProgress: 100 });
      // Redémarrage automatique pour charger la nouvelle version installée
      await relaunch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Updater] Erreur de téléchargement/installation:', msg);
      set({
        status: 'error',
        errorMessage: msg || "Échec du téléchargement ou de l'installation.",
      });
    }
  },

  relaunchApp: async () => {
    if (!isTauriEnvironment()) return;
    try {
      await relaunch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Updater] Échec du redémarrage:', msg);
    }
  },

  dismissUpdate: () => {
    set({ isDismissed: true });
  },
}));
