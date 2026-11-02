import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatDetailedDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours} h ${remainingMinutes} min`;
  }
  return `${totalMinutes} min`;
}

export function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const c = (hash & 0x00ffffff).toString(16).toUpperCase();
  return '#' + '00000'.substring(0, 6 - c.length) + c;
}

export const DEFAULT_TRACK_COVER = '/default_cover.jpg';

export function generateFallbackCoverSvg(_title?: string, _artist?: string): string {
  return DEFAULT_TRACK_COVER;
}

/**
 * Trie une liste de pistes dans leur ordre naturel séquentiel :
 * 1. Numéro de piste si disponible (sur un même album)
 * 2. Tri naturel sur le chemin de fichier (ex: 01.mp3, 02.mp3 ... 10.mp3)
 * 3. Titre en cas d'égalité
 */
export function sortTracksInOrder<
  T extends {
    filepath: string;
    track_number?: number | null;
    album?: string | null;
    title?: string | null;
  },
>(tracks: T[]): T[] {
  return [...tracks].sort((a, b) => {
    // 1. Numéro de piste si même album
    if (a.album && b.album && a.album.trim().toLowerCase() === b.album.trim().toLowerCase()) {
      if (
        typeof a.track_number === "number" &&
        typeof b.track_number === "number" &&
        a.track_number > 0 &&
        b.track_number > 0 &&
        a.track_number !== b.track_number
      ) {
        return a.track_number - b.track_number;
      }
    }
    // 2. Tri numérique naturel par nom de fichier / chemin
    const cmp = a.filepath.localeCompare(b.filepath, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (cmp !== 0) return cmp;
    // 3. Repli par titre
    return (a.title || "").localeCompare(b.title || "", undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}
