import { useState, useCallback } from 'react';
import { tauriApi } from '@/lib/tauri';
import type { ScannedTrackMetadata } from '@/types';

export interface UseFastFolderScannerResult {
  isScanning: boolean;
  scanDurationMs: number | null;
  scannedTracks: ScannedTrackMetadata[];
  error: string | null;
  scanFolder: (folderPath: string) => Promise<ScannedTrackMetadata[]>;
  clearScannedTracks: () => void;
}

export function useFastFolderScanner(): UseFastFolderScannerResult {
  const [isScanning, setIsScanning] = useState(false);
  const [scanDurationMs, setScanDurationMs] = useState<number | null>(null);
  const [scannedTracks, setScannedTracks] = useState<ScannedTrackMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scanFolder = useCallback(async (folderPath: string): Promise<ScannedTrackMetadata[]> => {
    setIsScanning(true);
    setError(null);
    const start = performance.now();

    try {
      // Parallelized metadata scan in Rust (ID3 text only, no picture bytes)
      const tracks = await tauriApi.scanMusicFolder(folderPath);
      const elapsed = Math.round(performance.now() - start);

      setScanDurationMs(elapsed);
      setScannedTracks(tracks);
      return tracks;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  const clearScannedTracks = useCallback(() => {
    setScannedTracks([]);
    setScanDurationMs(null);
    setError(null);
  }, []);

  return {
    isScanning,
    scanDurationMs,
    scannedTracks,
    error,
    scanFolder,
    clearScannedTracks,
  };
}
