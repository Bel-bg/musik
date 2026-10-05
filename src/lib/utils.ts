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

export function generateFallbackCoverSvg(title: string, artist: string): string {
  const initial1 = (title.trim()[0] || 'M').toUpperCase();
  const initial2 = (artist.trim()[0] || '').toUpperCase();
  const initials = initial2 ? `${initial1}${initial2}` : initial1;
  const color = stringToColor(title + artist);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="#111114"/>
    <circle cx="150" cy="150" r="110" fill="${color}" opacity="0.18"/>
    <circle cx="150" cy="150" r="70" fill="${color}" opacity="0.3"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="'Bricolage Grotesque', sans-serif" font-size="64" font-weight="800" fill="#f0f0f4" letter-spacing="-2">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
