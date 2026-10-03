import React from "react";
import { Play } from "lucide-react";
import { formatDuration, generateFallbackCoverSvg } from "@/lib/utils";
import { hapticAudio } from "@/lib/hapticAudio";
import { useTrackCover } from "@/hooks/useTrackCover";
import type { Track, ScannedTrackMetadata } from "@/types";

export interface TrackCardProps {
  track: ScannedTrackMetadata | Track;
  isCurrent?: boolean;
  isPlaying?: boolean;
  onPlay?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const TrackCard: React.FC<TrackCardProps> = ({
  track,
  isCurrent = false,
  isPlaying = false,
  onPlay,
  style,
  className = "",
}) => {
  const { coverUrl, isLoading } = useTrackCover(track);

  const handleClick = () => {
    hapticAudio.playHeavySwitch();
    onPlay?.();
  };

  const cover =
    coverUrl ?? generateFallbackCoverSvg(track.title, track.artist || "");

  return (
    <div
      style={style}
      onClick={handleClick}
      className={`group flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer select-none transition-colors ${
        isCurrent
          ? "bg-[#181920] border-[#ff9d33]/50"
          : "bg-[#101115] border-[#22242e] hover:bg-[#16171e] hover:border-[#323644]"
      } ${className}`}
    >
      {/* Cover */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#08090c]">
        <img
          src={cover}
          alt=""
          loading="lazy"
          className={`w-full h-full object-cover transition-opacity ${
            isLoading ? "opacity-0" : "opacity-100"
          }`}
        />

        <div
          className={`absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity ${
            isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isCurrent && isPlaying ? (
            <div className="flex gap-0.5">
              <span className="w-1 h-3.5 bg-[#ff9d33] rounded-sm" />
              <span className="w-1 h-3.5 bg-[#ff9d33] rounded-sm" />
            </div>
          ) : (
            <Play size={16} className="text-[#ff9d33] fill-current ml-0.5" />
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={`text-xs font-semibold truncate ${
            isCurrent ? "text-[#ff9d33]" : "text-[#f0f1f5]"
          }`}
        >
          {track.title}
        </span>
        <span className="text-[11px] text-[#8a8e9e] truncate mt-0.5">
          {track.artist || "Artiste inconnu"}
          {track.album && ` • ${track.album}`}
        </span>
      </div>

      {/* Durée */}
      <span className="font-mono text-xs text-[#6d7182] flex-shrink-0 pr-1">
        {formatDuration(track.duration)}
      </span>
    </div>
  );
};
