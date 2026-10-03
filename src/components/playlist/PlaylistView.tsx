import React, { useState, useEffect } from 'react';
import { Play, Download, Trash2, Edit2, ListMusic } from 'lucide-react';
import { usePlaylistStore } from '@/store/usePlaylistStore';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useLibraryStore } from '@/store/useLibraryStore';
import { formatDetailedDuration } from '@/lib/utils';
import { TrackListView } from '@/components/library/TrackListView';
import { Modal } from '@/components/common/Modal';
import { hapticAudio } from '@/lib/hapticAudio';

interface PlaylistViewProps {
  playlistId: string;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({ playlistId }) => {
  const {
    playlists,
    activePlaylist,
    activePlaylistTracks,
    loadPlaylistDetail,
    renamePlaylist,
    deletePlaylist,
    exportM3u,
  } = usePlaylistStore();

  const { playTrack } = usePlayerStore();
  const { setCurrentView } = useLibraryStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (playlistId) {
      loadPlaylistDetail(playlistId);
    }
  }, [playlistId, loadPlaylistDetail]);

  const currentPl = activePlaylist || playlists.find((p) => p.id === playlistId);
  const totalDuration = activePlaylistTracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  const handlePlayAll = () => {
    if (activePlaylistTracks.length > 0) {
      hapticAudio.playHeavySwitch();
      playTrack(activePlaylistTracks[0], activePlaylistTracks, 0);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && currentPl) {
      hapticAudio.playToggleSnap();
      await renamePlaylist(currentPl.id, newName.trim());
      setIsEditingName(false);
    }
  };

  const handleDelete = async () => {
    if (currentPl) {
      hapticAudio.playHeavySwitch();
      await deletePlaylist(currentPl.id);
      setIsDeleteModalOpen(false);
      setCurrentView('tracks');
    }
  };

  const handleExport = async () => {
    if (currentPl) {
      hapticAudio.playToggleSnap();
      const defaultName = `${currentPl.name.toLowerCase().replace(/\s+/g, '_')}.m3u`;
      await exportM3u(currentPl.id, defaultName);
    }
  };

  if (!currentPl) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center select-none skeuo-recessed rounded-lg mx-6 mt-6">
        <p className="text-text-muted text-sm font-mono uppercase tracking-wider">Bande introuvable ou éjectée.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Tape Box Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-end gap-6 skeuo-panel p-6 rounded-card border border-border metal-grain relative">
        {/* Cassette / Tape Box Shell */}
        <div className="w-36 h-36 rounded-card skeuo-recessed flex items-center justify-center text-accent flex-shrink-0 shadow-2xl relative border border-border/80">
          <div className="w-24 h-24 rounded-full border-2 border-dashed border-border flex items-center justify-center">
            <ListMusic size={36} className="text-accent/90" />
          </div>
          {/* Cassette reel spools */}
          <div className="absolute bottom-3 left-4 w-4 h-4 rounded-full bg-black/60 border border-white/10" />
          <div className="absolute bottom-3 right-4 w-4 h-4 rounded-full bg-black/60 border border-white/10" />
        </div>

        <div className="flex flex-col gap-2 min-w-0 flex-1 z-10">
          <span className="meta-label text-accent font-mono tracking-widest">BANDE ENREGISTRÉE</span>

          {isEditingName ? (
            <form onSubmit={handleRename} className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="skeuo-recessed rounded-btn px-3 py-1.5 text-xl font-bold text-text-primary focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 skeuo-btn bg-accent text-background rounded-btn text-xs font-bold"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="px-3.5 py-1.5 skeuo-btn text-text-muted rounded-btn text-xs font-bold"
              >
                Annuler
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold text-text-primary heading-tight truncate">
                {currentPl.name}
              </h1>
              <button
                onClick={() => {
                  hapticAudio.playToggleSnap();
                  setNewName(currentPl.name);
                  setIsEditingName(true);
                }}
                aria-label="Renommer la bande"
                className="p-1.5 rounded skeuo-btn text-text-muted hover:text-text-primary"
              >
                <Edit2 size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-text-muted font-mono-numbers">
            <span className="font-mono font-bold text-text-primary">
              {activePlaylistTracks.length}{' '}
              {activePlaylistTracks.length > 1 ? 'PISTES' : 'PISTE'}
            </span>
            <span>•</span>
            <span className="font-mono text-accent">{formatDetailedDuration(totalDuration)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handlePlayAll}
              disabled={activePlaylistTracks.length === 0}
              className="flex items-center gap-2 skeuo-btn px-5 py-2.5 rounded-btn font-bold text-xs text-accent hover:text-accent-hover shadow-glow disabled:opacity-40"
            >
              <Play size={14} fill="currentColor" />
              <span>Lancer la bande</span>
            </button>

            <button
              onClick={handleExport}
              title="Exporter au format M3U"
              className="flex items-center gap-2 skeuo-btn text-text-primary px-4 py-2.5 rounded-btn text-xs font-bold"
            >
              <Download size={13} />
              <span>Exporter M3U</span>
            </button>

            <button
              onClick={() => {
                hapticAudio.playToggleSnap();
                setIsDeleteModalOpen(true);
              }}
              title="Éjecter / Supprimer la bande"
              className="flex items-center gap-2 skeuo-btn text-red-400 hover:text-red-300 px-4 py-2.5 rounded-btn text-xs font-bold ml-auto"
            >
              <Trash2 size={13} />
              <span>Effacer la bande</span>
            </button>
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="skeuo-panel rounded-card p-4 metal-grain">
        <TrackListView
          tracks={activePlaylistTracks}
          currentPlaylistId={currentPl.id}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Effacer la bande audio"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted leading-relaxed">
            Êtes-vous certain de vouloir effacer l'index de la bande "{currentPl.name}" ? Vos fichiers audio d'origine resteront intacts sur votre disque dur.
          </p>
          <div className="flex justify-end gap-3 mt-2">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 rounded-btn skeuo-btn text-text-primary text-xs font-bold"
            >
              Annuler
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-btn skeuo-btn bg-red-700/80 hover:bg-red-600 text-white text-xs font-bold"
            >
              Confirmer suppression
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
