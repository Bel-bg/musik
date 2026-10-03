import React, { useState } from 'react';
import { Play, MoreHorizontal, Radio } from 'lucide-react';
import type { Track } from '@/types';
import { usePlayerStore } from '@/store/usePlayerStore';
import { formatDuration } from '@/lib/utils';
import { CoverArt } from '@/components/common/CoverArt';
import { EqualizerBars } from '@/components/common/EqualizerBars';
import { ContextMenu } from '@/components/common/ContextMenu';
import { hapticAudio } from '@/lib/hapticAudio';

interface TrackListViewProps {
  tracks: Track[];
  showCover?: boolean;
  currentPlaylistId?: string | null;
  onTrackRemove?: (trackId: string) => void;
}

export const TrackListView: React.FC<TrackListViewProps> = ({
  tracks,
  showCover = true,
  currentPlaylistId = null,
}) => {
  const { currentTrack, isPlaying, playTrack } = usePlayerStore();

  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    track: Track | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    track: null,
  });

  const handleRowDoubleClick = (track: Track, index: number) => {
    hapticAudio.playHeavySwitch();
    playTrack(track, tracks, index);
  };

  const handlePlayClick = (e: React.MouseEvent, track: Track, index: number) => {
    e.stopPropagation();
    hapticAudio.playHeavySwitch();
    playTrack(track, tracks, index);
  };

  const handleContextMenu = (e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    hapticAudio.playToggleSnap();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      track,
    });
  };

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center select-none skeuo-recessed rounded-xl mx-2 border border-border/40">
        <Radio size={36} className="text-text-subtle mb-3.5" />
        <p className="text-text-muted text-sm font-mono uppercase tracking-wider font-bold">
          Aucune piste répertoriée sur ce canal.
        </p>
        <span className="text-xs text-text-subtle mt-1 font-medium">
          Importez un dossier local pour peupler la console.
        </span>
      </div>
    );
  }

  return (
    <div className="w-full select-none">
      {/* Studio Cue Sheet Table Header */}
      <div className="grid grid-cols-[64px_1fr_1fr_120px_54px] px-5 py-3 text-xs font-mono font-extrabold text-text-muted border-b border-[#202430] uppercase tracking-widest bg-surface-cavity/70 rounded-t-lg">
        <div className="text-center">INDEX</div>
        <div>TITRE & ARTISTE</div>
        <div>ALBUM SOURCE</div>
        <div className="text-right">DURÉE</div>
        <div />
      </div>

      {/* Track rows - Channel strips */}
      <div className="divide-y divide-border/20">
        {tracks.map((track, index) => {
          const isCurrent = currentTrack?.id === track.id;

          return (
            <div
              key={track.id}
              onDoubleClick={() => handleRowDoubleClick(track, index)}
              onContextMenu={(e) => handleContextMenu(e, track)}
              className={`group grid grid-cols-[64px_1fr_1fr_120px_54px] items-center px-5 py-3.5 transition-colors cursor-pointer border-b border-black/40 ${
                isCurrent
                  ? 'bg-gradient-to-r from-amber-500/15 via-[#1a1e28] to-transparent text-accent border-l-4 border-l-accent'
                  : 'hover:bg-surface-secondary/70 text-text-primary'
              }`}
            >
              {/* Number / Equalizer / Play Icon */}
              <div className="flex items-center justify-center text-sm font-mono-numbers">
                {isCurrent ? (
                  <div className="flex items-center gap-1.5">
                    <EqualizerBars isPlaying={isPlaying} />
                  </div>
                ) : (
                  <>
                    <span className="group-hover:hidden text-text-subtle text-xs font-bold">
                      {String(track.track_number || index + 1).padStart(2, '0')}
                    </span>
                    <button
                      onClick={(e) => handlePlayClick(e, track, index)}
                      aria-label={`Lire ${track.title}`}
                      className="hidden group-hover:flex w-8 h-8 rounded-full skeuo-btn items-center justify-center text-accent hover:scale-110 transition-transform shadow-md"
                    >
                      <Play size={13} fill="currentColor" className="ml-0.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Title, Artist and Cover Art */}
              <div className="flex items-center gap-3.5 min-w-0 pr-4">
                {showCover && (
                  <div className="relative p-0.5 rounded-lg skeuo-recessed flex-shrink-0 border border-border">
                    <CoverArt
                      coverPath={track.cover_path}
                      title={track.title}
                      artist={track.artist}
                      size="sm"
                      className="w-11 h-11 rounded-md object-cover shadow-sm"
                    />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-extrabold truncate tracking-tight ${
                        isCurrent ? 'vfd-glow font-black' : 'text-text-primary'
                      }`}
                    >
                      {track.title}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent font-extrabold tracking-widest border border-accent/40 shadow-sm">
                        ON AIR
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-text-muted truncate font-semibold mt-0.5">
                    {track.artist}
                  </span>
                </div>
              </div>

              {/* Album */}
              <div className="text-xs text-text-muted truncate pr-4 font-mono font-medium">
                {track.album || '—'}
              </div>

              {/* Duration in DM Mono */}
              <div className="font-mono-numbers text-xs font-bold text-text-muted text-right">
                {formatDuration(track.duration)}
              </div>

              {/* Context menu trigger */}
              <div className="flex justify-end">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, track);
                  }}
                  aria-label="Options de piste"
                  className="p-1.5 rounded-btn skeuo-btn text-text-muted hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Context Menu instance */}
      {contextMenu.track && (
        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          onClose={() => setContextMenu({ isOpen: false, position: { x: 0, y: 0 }, track: null })}
          track={contextMenu.track}
          currentPlaylistId={currentPlaylistId}
        />
      )}
    </div>
  );
};
