import React, { useState } from 'react';
import {
  Music,
  ListPlus,
  Plus,
  Settings,
  ImagePlus,
  FolderOpen,
  X,
} from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { usePlaylistStore } from '@/store/usePlaylistStore';
import { Modal } from '@/components/common/Modal';
import { selectImageFile, getCoverImageUrl, isTauriEnvironment, tauriApi } from '@/lib/tauri';
import { hapticAudio } from '@/lib/hapticAudio';

type WizardStep = 'name' | 'cover' | 'folder';

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, selectedPlaylistId, openPlaylist, addWatchedFolderPath, isScanning } =
    useLibraryStore();
  const { playlists, createPlaylist, addTracksToPlaylist, loadPlaylistDetail } = usePlaylistStore();

  const [isNewPlaylistModalOpen, setIsNewPlaylistModalOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>('name');
  const [playlistName, setPlaylistName] = useState('');
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const openModal = () => {
    hapticAudio.playHeavySwitch();
    setStep('name');
    setPlaylistName('');
    setCoverPath(null);
    setIsNewPlaylistModalOpen(true);
  };

  const closeModal = () => {
    hapticAudio.playToggleSnap();
    setIsNewPlaylistModalOpen(false);
  };

  const handleNameNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (playlistName.trim()) {
      hapticAudio.playToggleSnap();
      setStep('cover');
    }
  };

  const handlePickCover = async () => {
    hapticAudio.playToggleSnap();
    const picked = await selectImageFile();
    if (picked) setCoverPath(picked);
  };

  const handleClearCover = () => {
    hapticAudio.playToggleSnap();
    setCoverPath(null);
  };

  const handleCoverNext = () => {
    hapticAudio.playToggleSnap();
    setStep('folder');
  };

  const handlePickFolder = async () => {
    hapticAudio.playHeavySwitch();
    const folderPath = await tauriApi.selectFolder();
    if (!folderPath) return;

    setIsSaving(true);
    try {
      const playlist = await createPlaylist(playlistName.trim(), coverPath);
      await addWatchedFolderPath(folderPath);

      const { tracks } = useLibraryStore.getState();
      const normalized = folderPath.replace(/\\/g, '/');
      const folderTracks = tracks.filter((t) =>
        t.filepath.replace(/\\/g, '/').startsWith(normalized + '/')
      );
      if (folderTracks.length > 0) {
        await addTracksToPlaylist(
          playlist.id,
          folderTracks.map((t) => t.id)
        );
      }

      openPlaylist(playlist.id);
      await loadPlaylistDetail(playlist.id);

      closeModal();
    } catch (err) {
      console.error('Erreur creation playlist:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinishWithoutFolder = async () => {
    hapticAudio.playHeavySwitch();
    setIsSaving(true);
    try {
      const playlist = await createPlaylist(playlistName.trim(), coverPath);
      openPlaylist(playlist.id);
      closeModal();
    } catch (err) {
      console.error('Erreur creation playlist:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const coverPreviewUrl = getCoverImageUrl(coverPath);

  const modalTitle =
    step === 'name'
      ? 'Nouvelle bande / Playlist'
      : step === 'cover'
      ? 'Étiquette de cassette'
      : 'Remplissage des pistes';

  return (
    <aside className="w-72 skeuo-panel h-full flex flex-col justify-between select-none py-6 px-4 border-r border-[#202430] metal-grain relative">
      {/* Decorative Milled Hex Screws */}
      <div className="absolute top-3 left-3 w-2.5 h-2.5 rounded-full bg-[#1e222d] border border-white/10 shadow-inner flex items-center justify-center pointer-events-none">
        <div className="w-1.5 h-0.5 bg-black/80" />
      </div>
      <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#1e222d] border border-white/10 shadow-inner flex items-center justify-center pointer-events-none">
        <div className="w-1.5 h-0.5 bg-black/80" />
      </div>
      <div className="absolute bottom-3 left-3 w-2.5 h-2.5 rounded-full bg-[#1e222d] border border-white/10 shadow-inner flex items-center justify-center pointer-events-none">
        <div className="w-1.5 h-0.5 bg-black/80" />
      </div>
      <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-[#1e222d] border border-white/10 shadow-inner flex items-center justify-center pointer-events-none">
        <div className="w-1.5 h-0.5 bg-black/80" />
      </div>

      <div className="flex flex-col gap-7 overflow-hidden z-10">
        {/* Hardware Brand Badge */}
        <div className="px-2 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl skeuo-btn flex items-center justify-center font-extrabold text-accent border border-accent/40 shadow-glow p-1.5 overflow-hidden">
            <img src="/icon.png" alt="MUSIK Logo" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div className="flex flex-col">
            <span className="heading-tight text-xl text-text-primary tracking-widest font-black">
              MUSIK
            </span>
            <span className="text-[10px] font-mono text-accent font-bold tracking-widest">
              HI-FI DECK PRO
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          {/* Section: Main Channel Selector */}
          <div className="flex flex-col gap-2">
            <span className="meta-label px-2 text-xs">Canal Maître</span>
            <button
              onClick={() => {
                hapticAudio.playToggleSnap();
                setCurrentView('tracks');
              }}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-extrabold transition-all ${
                currentView === 'tracks'
                  ? 'skeuo-btn-active text-accent'
                  : 'skeuo-btn text-text-muted hover:text-text-primary'
              }`}
            >
              {/* Dual-state indicator LED */}
              <div
                className={`w-2.5 h-2.5 rounded-full border border-black/80 ${
                  currentView === 'tracks'
                    ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                    : 'bg-emerald-500/30'
                }`}
              />
              <Music size={18} />
              <span>Tous les morceaux</span>
            </button>
          </div>

          {/* Section: Cassette Rack (Playlists) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-2">
              <span className="meta-label text-xs">Racks de Bandes</span>
              <button
                onClick={openModal}
                title="Créer une nouvelle bande / playlist"
                aria-label="Créer une playlist"
                className="p-1.5 rounded skeuo-btn text-accent hover:text-accent-hover"
              >
                <Plus size={15} />
              </button>
            </div>

            {playlists.length === 0 ? (
              <span className="px-3 py-3 text-xs text-text-subtle font-mono skeuo-recessed rounded-lg text-center">
                Rack vide
              </span>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto px-1">
                {playlists.map((pl) => {
                  const isActive =
                    currentView === 'playlist-detail' && selectedPlaylistId === pl.id;
                  const plCoverUrl = getCoverImageUrl(pl.cover_path);

                  return (
                    <button
                      key={pl.id}
                      onClick={() => {
                        hapticAudio.playToggleSnap();
                        openPlaylist(pl.id);
                      }}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-left truncate transition-all ${
                        isActive
                          ? 'skeuo-btn-active text-accent font-extrabold'
                          : 'skeuo-btn text-text-muted hover:text-text-primary'
                      }`}
                    >
                      <div
                        className={`w-2 h-2 rounded-full border border-black/80 flex-shrink-0 ${
                          isActive
                            ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                            : 'bg-white/20'
                        }`}
                      />
                      {plCoverUrl ? (
                        <img
                          src={plCoverUrl}
                          alt=""
                          className="w-5 h-5 rounded object-cover flex-shrink-0 border border-white/10"
                        />
                      ) : (
                        <ListPlus size={16} className="flex-shrink-0" />
                      )}
                      <span className="truncate">{pl.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom section: Settings */}
      <div className="flex flex-col gap-1 border-t border-[#202430] pt-4 z-10">
        <button
          onClick={() => {
            hapticAudio.playToggleSnap();
            setCurrentView('settings');
          }}
          className={`flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-extrabold transition-all ${
            currentView === 'settings'
              ? 'skeuo-btn-active text-accent'
              : 'skeuo-btn text-text-muted hover:text-text-primary'
          }`}
        >
          <div
            className={`w-2.5 h-2.5 rounded-full border border-black/80 ${
              currentView === 'settings'
                ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                : 'bg-white/20'
            }`}
          />
          <Settings size={18} />
          <span>Paramètres du deck</span>
        </button>
      </div>

      {/* Playlist creation wizard modal */}
      <Modal
        isOpen={isNewPlaylistModalOpen}
        onClose={closeModal}
        title={modalTitle}
      >
        {step === 'name' && (
          <form onSubmit={handleNameNext} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="pl-name-input" className="meta-label text-xs">
                Intitulé de la bande
              </label>
              <input
                id="pl-name-input"
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Ex: Studio Session, Jazz Tape, Master..."
                autoFocus
                className="skeuo-recessed rounded-btn px-4 py-2.5 text-base text-text-primary focus:outline-none focus:border-accent font-medium"
              />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-btn skeuo-btn text-text-muted hover:text-text-primary text-xs font-bold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!playlistName.trim()}
                className="px-5 py-2.5 rounded-btn skeuo-btn bg-accent text-background text-xs font-bold disabled:opacity-40"
              >
                Suivant
              </button>
            </div>
          </form>
        )}

        {step === 'cover' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              Appliquez une étiquette graphique sur la cassette{' '}
              <span className="text-accent font-bold">{playlistName}</span>.
            </p>

            <div className="flex flex-col items-center gap-3">
              {coverPath && coverPreviewUrl ? (
                <div className="relative p-1.5 rounded-xl skeuo-recessed">
                  <img
                    src={coverPreviewUrl}
                    alt="Apercu étiquette"
                    className="w-36 h-36 rounded-lg object-cover border border-border"
                  />
                  <button
                    onClick={handleClearCover}
                    aria-label="Supprimer la couverture"
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full skeuo-btn flex items-center justify-center text-text-muted hover:text-red-400"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="w-36 h-36 rounded-xl skeuo-recessed flex items-center justify-center text-text-subtle">
                  <ImagePlus size={36} />
                </div>
              )}

              {isTauriEnvironment() && (
                <button
                  type="button"
                  onClick={handlePickCover}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-btn skeuo-btn text-text-primary text-xs font-bold"
                >
                  <ImagePlus size={16} />
                  {coverPath ? "Changer l'image" : 'Choisir une étiquette'}
                </button>
              )}
            </div>

            <div className="flex justify-between gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  hapticAudio.playToggleSnap();
                  setStep('name');
                }}
                className="px-5 py-2.5 rounded-btn skeuo-btn text-text-muted hover:text-text-primary text-xs font-bold"
              >
                Retour
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleFinishWithoutFolder}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-btn skeuo-btn text-text-muted hover:text-text-primary text-xs font-bold disabled:opacity-40"
                >
                  Finaliser vide
                </button>
                <button
                  type="button"
                  onClick={handleCoverNext}
                  className="px-5 py-2.5 rounded-btn skeuo-btn text-accent font-bold text-xs"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'folder' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              Sélectionnez un dossier de fichiers audio à enregistrer directement sur cette bande.
            </p>

            {isScanning && (
              <p className="text-xs text-accent vfd-glow font-mono animate-pulse font-bold">
                Lecture et indexation du dossier en cours...
              </p>
            )}

            <div className="flex justify-between gap-3 mt-2">
              <button
                type="button"
                onClick={() => {
                  hapticAudio.playToggleSnap();
                  setStep('cover');
                }}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-btn skeuo-btn text-text-muted hover:text-text-primary text-xs font-bold disabled:opacity-40"
              >
                Retour
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleFinishWithoutFolder}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-btn skeuo-btn text-text-muted hover:text-text-primary text-xs font-bold disabled:opacity-40"
                >
                  Ignorer
                </button>
                <button
                  type="button"
                  onClick={handlePickFolder}
                  disabled={isSaving || isScanning || !isTauriEnvironment()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-btn skeuo-btn text-accent font-bold text-xs disabled:opacity-40"
                >
                  <FolderOpen size={16} />
                  Sélectionner dossier
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </aside>
  );
};
