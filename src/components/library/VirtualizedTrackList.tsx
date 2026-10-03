import React from "react";
import { List } from "react-window";
import { TrackCard } from "@/components/library/TrackCard";
import type { Track, ScannedTrackMetadata } from "@/types";

const GAP = 6;

interface RowData {
  tracks: (ScannedTrackMetadata | Track)[];
  currentTrackId?: string | null;
  isPlaying: boolean;
  onPlayTrack?: (track: ScannedTrackMetadata | Track, index: number) => void;
  cardHeight: number;
}

const Row = ({
  index,
  style,
  tracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  cardHeight,
}: {
  index: number;
  style: React.CSSProperties;
} & RowData) => {
  const track = tracks[index];
  if (!track) return null;

  return (
    <div style={style}>
      <TrackCard
        track={track}
        isCurrent={currentTrackId === track.id}
        isPlaying={isPlaying}
        onPlay={() => onPlayTrack?.(track, index)}
        style={{ height: cardHeight }}
      />
    </div>
  );
};

interface VirtualizedTrackListProps {
  tracks: (ScannedTrackMetadata | Track)[];
  currentTrackId?: string | null;
  isPlaying?: boolean;
  onPlayTrack?: (track: ScannedTrackMetadata | Track, index: number) => void;
  cardHeight?: number;
  className?: string;
}

export const VirtualizedTrackList: React.FC<VirtualizedTrackListProps> = ({
  tracks,
  currentTrackId,
  isPlaying = false,
  onPlayTrack,
  cardHeight = 76,
  className = "",
}) => {
  if (tracks.length === 0) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center text-center p-6 text-[#7a8194] font-mono text-xs ${className}`}
      >
        Aucun morceau dans cette liste
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full min-h-[200px] overflow-hidden select-none ${className}`}
    >
      <List<RowData>
        rowCount={tracks.length}
        rowHeight={cardHeight + GAP}
        rowComponent={Row}
        rowProps={{
          tracks,
          currentTrackId,
          isPlaying,
          onPlayTrack,
          cardHeight,
        }}
        overscanCount={6}
        style={{ height: "100%", width: "100%", scrollbarWidth: "none" }}
        className="[&::-webkit-scrollbar]:hidden"
      />

      {/* Dégradé haut */}
      <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black to-transparent pointer-events-none" />

      {/* Dégradé bas */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </div>
  );
};
