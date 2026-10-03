import { useState, useEffect } from 'react';
import { tauriApi, getCoverImageUrl } from '@/lib/tauri';
import type { Track, ScannedTrackMetadata } from '@/types';

// Bounded LRU in-memory cache for cover URLs (shared by every component).
const MAX_CACHE_SIZE = 150;
export const coverDataUrlCache = new Map<string, string | null>();

// In-flight extraction promises, so the same track displayed in several places
// (carousel card, mini player, blurred background, queue...) triggers a single IPC call.
const pendingRequests = new Map<string, Promise<string | null>>();

export function getCachedCoverUrl(filepath: string): string | null | undefined {
  const value = coverDataUrlCache.get(filepath);
  if (value !== undefined) {
    // Refresh LRU position
    coverDataUrlCache.delete(filepath);
    coverDataUrlCache.set(filepath, value);
  }
  return value;
}

export function setCachedCoverUrl(filepath: string, url: string | null) {
  if (coverDataUrlCache.has(filepath)) coverDataUrlCache.delete(filepath);
  if (coverDataUrlCache.size >= MAX_CACHE_SIZE) {
    const oldest = coverDataUrlCache.keys().next().value;
    if (oldest) coverDataUrlCache.delete(oldest);
  }
  coverDataUrlCache.set(filepath, url);
}

type CoverSource = Pick<Track | ScannedTrackMetadata, 'filepath' | 'cover_path'>;

/**
 * Resolves a track cover. Same strategy as the queue list: the picture embedded
 * in the audio file is extracted first; `cover_path` is only used as a fallback.
 */
export function resolveTrackCover(track: CoverSource): Promise<string | null> {
  const cached = getCachedCoverUrl(track.filepath);
  if (cached !== undefined) return Promise.resolve(cached);

  const pending = pendingRequests.get(track.filepath);
  if (pending) return pending;

  const fallback = track.cover_path ? getCoverImageUrl(track.cover_path) : null;

  const request = tauriApi
    .extractMp3Cover(track.filepath)
    .then((dataUrl) => dataUrl || fallback)
    .catch((err) => {
      console.warn(`[useTrackCover] Failed to extract cover for ${track.filepath}:`, err);
      return fallback;
    })
    .then((url) => {
      setCachedCoverUrl(track.filepath, url);
      pendingRequests.delete(track.filepath);
      return url;
    });

  pendingRequests.set(track.filepath, request);
  return request;
}

export function useTrackCover(track?: Track | ScannedTrackMetadata | null) {
  const filepath = track?.filepath;
  const coverPath = track?.cover_path ?? null;

  const [state, setState] = useState<{ key: string | undefined; url: string | null; loading: boolean }>(
    () => {
      if (!filepath) return { key: filepath, url: null, loading: false };
      const cached = getCachedCoverUrl(filepath);
      return { key: filepath, url: cached ?? null, loading: cached === undefined };
    }
  );

  useEffect(() => {
    if (!filepath) {
      setState({ key: filepath, url: null, loading: false });
      return;
    }

    const cached = getCachedCoverUrl(filepath);
    if (cached !== undefined) {
      setState({ key: filepath, url: cached, loading: false });
      return;
    }

    let isCancelled = false;
    setState({ key: filepath, url: null, loading: true });

    resolveTrackCover({ filepath, cover_path: coverPath }).then((url) => {
      if (!isCancelled) setState({ key: filepath, url, loading: false });
    });

    return () => {
      isCancelled = true;
    };
  }, [filepath, coverPath]);

  // Never expose a stale cover belonging to the previous track.
  const isStale = state.key !== filepath;
  return {
    coverUrl: isStale ? null : state.url,
    isLoading: isStale ? !!filepath : state.loading,
  };
}
