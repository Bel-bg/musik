import React from 'react';
import { Search, FolderPlus, RefreshCw, Radio } from 'lucide-react';
import { useLibraryStore } from '@/store/useLibraryStore';
import { hapticAudio } from '@/lib/hapticAudio';

interface HeaderProps {
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch }) => {
  const { addWatchedFolder, isScanning, scanMessage } = useLibraryStore();

  const handleOpenSearch = () => {
    hapticAudio.playToggleSnap();
    onOpenSearch();
  };

  const handleImport = () => {
    hapticAudio.playHeavySwitch();
    addWatchedFolder();
  };

  return (
    <header className="h-20 skeuo-panel px-8 flex items-center justify-between select-none z-20 border-b border-[#202430] metal-grain">
      {/* Search Input Trigger in Recessed Cavity */}
      <button
        onClick={handleOpenSearch}
        className="flex items-center gap-3.5 skeuo-recessed rounded-lg px-4 py-2.5 w-96 text-left transition-all text-text-muted hover:text-text-primary group border border-border"
      >
        <Search size={16} className="text-accent group-hover:scale-110 transition-transform" />
        <span className="text-sm font-medium flex-1">Rechercher une piste ou bande...</span>
        <kbd className="font-mono text-xs font-bold bg-surface-plate px-2 py-0.5 rounded border border-border text-text-subtle group-hover:text-accent">
          Ctrl K
        </kbd>
      </button>

      {/* Right Actions: System Status & Import button */}
      <div className="flex items-center gap-5">
        {/* Hardware Status / Scanning indicator */}
        {isScanning ? (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-lg skeuo-screen text-accent text-xs font-mono font-bold border border-accent/40 shadow-glow">
            <RefreshCw size={15} className="animate-spin text-accent" />
            <span className="vfd-glow">{scanMessage || 'INDEXATION EN COURS...'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-mono text-text-subtle font-bold">
            <Radio size={14} className="text-emerald-500 animate-pulse" />
            <span>MOTEUR AUDIO LOCAL ACTIF</span>
          </div>
        )}

        <button
          onClick={handleImport}
          className="flex items-center gap-2.5 skeuo-btn px-5 py-2.5 rounded-lg text-sm font-bold text-text-primary hover:text-accent transition-all active:scale-95 shadow-md"
        >
          <FolderPlus size={17} className="text-accent" />
          <span>Importer un dossier</span>
        </button>
      </div>
    </header>
  );
};
