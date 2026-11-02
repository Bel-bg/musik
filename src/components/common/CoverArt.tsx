import React, { useState } from 'react';
import { getCoverImageUrl } from '@/lib/tauri';
import { DEFAULT_TRACK_COVER } from '@/lib/utils';

interface CoverArtProps {
  coverPath: string | null;
  title: string;
  artist: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-10 h-10 rounded-md',
  md: 'w-14 h-14 rounded-lg',
  lg: 'w-44 h-44 rounded-2xl',
  xl: 'w-60 h-60 rounded-2xl',
};

export const CoverArt: React.FC<CoverArtProps> = ({
  coverPath,
  title,
  artist: _artist,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const fallbackSrc = DEFAULT_TRACK_COVER;
  const coverUrl = !imageError && coverPath ? getCoverImageUrl(coverPath) : null;

  return (
    <div
      className={`relative overflow-hidden bg-surface-secondary flex-shrink-0 shadow-card ${sizeClasses[size]} ${className}`}
    >
      {coverUrl ? (
        <img
          src={coverUrl}
          alt={`Pochette de ${title}`}
          className="w-full h-full object-cover select-none pointer-events-none"
          onError={() => setImageError(true)}
          loading="lazy"
        />
      ) : (
        <img
          src={fallbackSrc}
          alt={`Pochette ${title}`}
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      )}
    </div>
  );
};
