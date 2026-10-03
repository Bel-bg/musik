import React, { useState } from "react";
import { generateFallbackCoverSvg } from "@/lib/utils";
import { useTrackCover } from "@/hooks/useTrackCover";
import type { Track } from "@/types";

interface CoverDisplayProps {
  track?: Track | null;
  className?: string;
  isGrayscale?: boolean;
}

export const CoverDisplay: React.FC<CoverDisplayProps> = ({
  track,
  className = "",
  isGrayscale = false,
}) => {
  const { coverUrl, isLoading } = useTrackCover(track);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="w-full h-full bg-[#08090c] relative overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#181a24] to-transparent animate-pulse" />
      </div>
    );
  }

  const usableCover = coverUrl && coverUrl !== failedUrl ? coverUrl : null;
  const finalSrc =
    usableCover ||
    (track ? generateFallbackCoverSvg(track.title, track.artist || "") : "");

  return (
    <img
      src={finalSrc}
      alt={track?.title || ""}
      draggable={false}
      onError={() => usableCover && setFailedUrl(usableCover)}
      className={`${className} ${isGrayscale ? "grayscale opacity-75" : ""} transition-opacity duration-300`}
    />
  );
};
