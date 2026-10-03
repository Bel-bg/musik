import React, { useState } from 'react';
import { Plus, ListMusic, FolderOpen } from 'lucide-react';
import { usePlaylistStore } from '@/store/usePlaylistStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { Modal } from '@/components/common/Modal';
import { selectImageFile, tauriApi } from '@/lib/tauri';
import { hapticAudio } from '@/lib/hapticAudio';
import type { Playlist } from '@/types';
import backgroundImg from '../../../assets/background.png';
import { VinylPlaylistCard } from './VinylPlaylistCard';

interface PlaylistHomeViewProps {
  onOpenPlaylist: (playlistId: string) => void;
}

export const PlaylistHomeView: React.FC<PlaylistHomeViewProps> = ({
  onOpenPlaylist,
}) => {
  const { playlists, createPlaylist, deletePlaylist, addTracksToPlaylist, loadPlaylistDetail } =
    usePlaylistStore();
  const { playTrack } = usePlayerStore();
  const { addWatchedFolderPath } = useLibraryStore();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingPlaylist, setDeletingPlaylist] = useState<Playlist | null>(null);

  const openCreateModal = () => {
    hapticAudio.playHeavySwitch();
    setPlaylistName('');
    setCoverPath(null);
    setSelectedFolder(null);
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    hapticAudio.playToggleSnap();
    setIsCreateModalOpen(false);
  };

  const handlePickCover = async () => {
    hapticAudio.playToggleSnap();
    const picked = await selectImageFile();
    if (picked) setCoverPath(picked);
  };

  const handlePickFolder = async () => {
    hapticAudio.playToggleSnap();
    const folder = await tauriApi.selectFolder();
    if (folder) setSelectedFolder(folder);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    setIsSaving(true);
    hapticAudio.playHeavySwitch();
    try {
      const pl = await createPlaylist(playlistName.trim(), coverPath);

      if (selectedFolder) {
        await addWatchedFolderPath(selectedFolder);
        const { tracks } = useLibraryStore.getState();
        const normalized = selectedFolder.replace(/\\/g, '/');
        const folderTracks = tracks.filter((t) =>
          t.filepath.replace(/\\/g, '/').startsWith(normalized + '/')
        );
        if (folderTracks.length > 0) {
          await addTracksToPlaylist(
            pl.id,
            folderTracks.map((t) => t.id)
          );
        }
      }

      await loadPlaylistDetail(pl.id);
      setIsCreateModalOpen(false);
      onOpenPlaylist(pl.id);
    } catch (err) {
      console.error('Erreur création playlist:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectPlay = async (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    hapticAudio.playHeavySwitch();
    try {
      const tracks = await tauriApi.getPlaylistTracks(pl.id);
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks, 0);
      }
      onOpenPlaylist(pl.id);
    } catch (err) {
      console.error('Erreur lecture playlist:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPlaylist) return;
    hapticAudio.playHeavySwitch();
    await deletePlaylist(deletingPlaylist.id);
    setDeletingPlaylist(null);
  };

  return (
    <div
      className="flex-1 h-full w-full overflow-y-auto select-none bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="flex flex-col p-8 max-w-6xl mx-auto w-full min-h-full">
        {/* Top Welcome Title */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#202430]">
        <div>
          <h1 className="text-3xl font-black text-text-primary heading-tight tracking-tight mt-1">
            Playlists
          </h1>
        </div>
      </div>

      {/* Playlists Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-16">
        {/* "+ Créer une bande" Card */}
        <button
          onClick={openCreateModal}
          className="group relative flex flex-col items-center justify-center p-6 aspect-[1.32/1] rounded-xl skeuo-recessed border-2 border-dashed border-border/80 hover:border-accent/60 transition-all text-text-muted hover:text-accent shadow-inner"
        >
          <div className="w-14 h-14 rounded-full skeuo-btn flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <Plus size={24} className="text-accent" />
          </div>
          <span className="text-sm font-bold tracking-tight">Ajouter une bande</span>
          <span className="text-[11px] text-text-subtle font-mono mt-1">Dossier local ou vierge</span>
        </button>

        {/* Existing Playlists Cards (Vinyl Record Style) */}
        {playlists.map((pl) => (
          <VinylPlaylistCard
            key={pl.id}
            playlist={pl}
            onOpen={onOpenPlaylist}
            onPlay={(playlist, e) => handleDirectPlay(e, playlist)}
            onDelete={(playlist) => setDeletingPlaylist(playlist)}
          />
        ))}
      </div>

      {/* Create Playlist Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        title="Créer une nouvelle bande de lecture"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="modal-pl-name" className="meta-label text-xs">
              Nom de la playlist
            </label>
            <input
              id="modal-pl-name"
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Ex: Master Mix, Lo-Fi Chill, Favoris..."
              autoFocus
              className="skeuo-recessed rounded-btn px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent font-medium border border-border"
            />
          </div>

          {/* Folder selection (Optional) */}
          <div className="flex flex-col gap-1.5">
            <span className="meta-label text-xs">Dossier musical source (facultatif)</span>
            <button
              type="button"
              onClick={handlePickFolder}
              className="flex items-center justify-between px-4 py-2.5 rounded-btn skeuo-btn text-xs font-bold text-text-primary border border-border"
            >
              <div className="flex items-center gap-2 truncate">
                <FolderOpen size={16} className="text-accent flex-shrink-0" />
                <span className="truncate">
                  {selectedFolder || 'Sélectionner un dossier MP3 / FLAC'}
                </span>
              </div>
              {selectedFolder && (
                <span className="text-[10px] font-mono text-accent uppercase font-bold">Choisi</span>
              )}
            </button>
          </div>

          {/* Cover image (Optional) */}
          <div className="flex flex-col gap-1.5">
            <span className="meta-label text-xs">Image d'étiquette (facultatif)</span>
            <button
              type="button"
              onClick={handlePickCover}
              className="flex items-center justify-between px-4 py-2.5 rounded-btn skeuo-btn text-xs font-bold text-text-primary border border-border"
            >
              <div className="flex items-center gap-2 truncate">
                <ListMusic size={16} className="text-accent flex-shrink-0" />
                <span className="truncate">{coverPath ? 'Image sélectionnée' : 'Choisir une image'}</span>
              </div>
            </button>
          </div>

          <div className="flex justify-end gap-3 mt-3">
            <button
              type="button"
              onClick={closeCreateModal}
              className="px-4 py-2 rounded-btn skeuo-btn text-xs font-bold text-text-muted hover:text-text-primary"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!playlistName.trim() || isSaving}
              className="px-5 py-2 rounded-btn skeuo-btn bg-accent text-background text-xs font-bold shadow-glow disabled:opacity-40"
            >
              {isSaving ? 'Création en cours...' : 'Créer la bande'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deletingPlaylist !== null}
        onClose={() => setDeletingPlaylist(null)}
        title="Supprimer la playlist"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted leading-relaxed">
            Voulez-vous vraiment supprimer la playlist "{deletingPlaylist?.name}" ? Vos fichiers musicaux d'origine ne seront pas affectés.
          </p>
          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={() => setDeletingPlaylist(null)}
              className="px-4 py-2 rounded-btn skeuo-btn text-text-primary text-xs font-bold"
            >
              Annuler
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 rounded-btn skeuo-btn bg-red-700/80 hover:bg-red-600 text-white text-xs font-bold"
            >
              Confirmer suppression
            </button>
          </div>
        </div>
      </Modal>
      </div>
    </div>
  );
};
