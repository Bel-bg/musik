import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  ListMusic,
  Gauge,
  Timer,
} from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { formatDuration } from '@/lib/utils';
import { CoverArt } from '@/components/common/CoverArt';
import { Slider } from '@/components/common/Slider';
import { Knob } from '@/components/common/Knob';
import { VuMeterCanvas } from '@/components/player/VuMeterCanvas';
import { hapticAudio } from '@/lib/hapticAudio';

interface PlayerBarProps {
  onToggleQueue: () => void;
  isQueueOpen: boolean;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  onToggleQueue,
  isQueueOpen,
}) => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    playbackSpeed,
    sleepTimer,
    sleepTimerActive,
    queue,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    setPlaybackSpeed,
    setSleepTimer,
  } = usePlayerStore();

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);

  const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
  const timerOptions = [
    { label: 'Désactivé', minutes: null },
    { label: '15 minutes', minutes: 15 },
    { label: '30 minutes', minutes: 30 },
    { label: '45 minutes', minutes: 45 },
    { label: '60 minutes', minutes: 60 },
  ];

  const handlePlayToggle = () => {
    hapticAudio.playHeavySwitch();
    togglePlay();
  };

  const handlePrev = () => {
    hapticAudio.playToggleSnap();
    prevTrack();
  };

  const handleNext = () => {
    hapticAudio.playToggleSnap();
    nextTrack();
  };

  const handleShuffle = () => {
    hapticAudio.playToggleSnap();
    toggleShuffle();
  };

  const handleRepeat = () => {
    hapticAudio.playToggleSnap();
    toggleRepeat();
  };

  return (
    <footer className="h-36 skeuo-panel px-8 flex items-center justify-between z-30 select-none border-t border-[#202430] metal-grain relative">
      {/* LEFT SECTION: Large Recessed Track Plate & Cover Art */}
      <div className="flex items-center gap-4 w-1/4 min-w-[280px] z-10">
        {currentTrack ? (
          <>
            {/* Chunky Recessed Cover Art Frame */}
            <div className="relative p-1.5 rounded-xl skeuo-recessed shadow-xl flex-shrink-0 border border-border">
              <CoverArt
                coverPath={currentTrack.cover_path}
                title={currentTrack.title}
                artist={currentTrack.artist}
                size="md"
                className="w-20 h-20 rounded-lg object-cover shadow-lg"
              />
              {/* Tape Status LED */}
              <div
                className={`absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border-2 border-black/80 ${
                  isPlaying
                    ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b]'
                    : 'bg-emerald-500/40 shadow-none'
                }`}
              />
            </div>

            <div className="flex flex-col min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-surface-cavity border border-accent/40 text-accent">
                  HI-FI MASTER
                </span>
                <span className="text-[11px] font-mono text-text-muted font-bold">
                  {currentTrack.duration ? `${Math.round(currentTrack.duration)}s` : 'STEREO'}
                </span>
              </div>
              <span className="text-text-primary text-base font-extrabold truncate tracking-tight">
                {currentTrack.title}
              </span>
              <span className="text-text-muted text-xs truncate font-semibold mt-0.5">
                {currentTrack.artist}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3.5">
            <div className="w-20 h-20 rounded-xl skeuo-recessed flex items-center justify-center border border-border">
              <div className="w-3 h-3 rounded-full bg-text-subtle/50" />
            </div>
            <div className="flex flex-col">
              <span className="text-text-subtle text-xs font-mono font-bold uppercase tracking-wider">
                DECK VIDE
              </span>
              <span className="text-text-muted text-xs mt-0.5 font-medium">Aucune bande chargée</span>
            </div>
          </div>
        )}
      </div>

      {/* CENTER SECTION: Large VFD Console + Stereo VU-Meter + Big Mechanical Controls */}
      <div className="flex flex-col items-center justify-center flex-1 max-w-3xl px-6 z-10">
        {/* Large Recessed VFD Screen */}
        <div className="w-full skeuo-screen rounded-xl px-5 py-2.5 mb-3 flex items-center justify-between gap-5 border border-border/80 shadow-2xl">
          {/* VFD Information Feed */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-accent">
                {isPlaying ? '● PLAYING' : '❚❚ STANDBY'}
              </span>
              <span className="text-[10px] font-mono text-text-subtle">|</span>
              <span className="text-[10px] font-mono text-emerald-400 font-extrabold uppercase">
                DIRECT PCM 44.1kHz • 24-BIT
              </span>
            </div>
            <div className="text-sm font-mono font-extrabold truncate vfd-glow mt-1 tracking-tight">
              {currentTrack
                ? `${currentTrack.artist} — ${currentTrack.title}`
                : 'MUSIK HI-FI AUDIO SYSTEM READY'}
            </div>
          </div>

          {/* Large Time Counter */}
          <div className="flex items-center gap-1.5 font-mono text-sm font-extrabold bg-black/60 px-3.5 py-1.5 rounded-lg border border-border">
            <span className="vfd-glow text-base">{formatDuration(currentTime)}</span>
            <span className="text-text-subtle font-normal">/</span>
            <span className="text-text-muted">{formatDuration(duration)}</span>
          </div>

          {/* Large Canvas 2D Stereo VU-Meter */}
          <VuMeterCanvas isPlaying={isPlaying} width={180} height={46} />
        </div>

        {/* Transport Buttons & Scrubber */}
        <div className="w-full flex items-center gap-5">
          {/* Mechanical Push-buttons */}
          <div className="flex items-center gap-2.5">
            {/* Shuffle Toggle */}
            <button
              onClick={handleShuffle}
              title={shuffle ? 'Mode Aléatoire Actif' : 'Mode Aléatoire Désactivé'}
              aria-label="Mode Aléatoire"
              className={`w-10 h-10 rounded-btn flex items-center justify-center transition-all ${
                shuffle ? 'skeuo-btn-active text-accent' : 'skeuo-btn text-text-muted hover:text-text-primary'
              }`}
            >
              <Shuffle size={16} />
            </button>

            {/* Skip Back */}
            <button
              onClick={handlePrev}
              title="Piste Précédente"
              aria-label="Piste Précédente"
              className="w-10 h-10 rounded-btn skeuo-btn flex items-center justify-center text-text-primary hover:text-accent"
            >
              <SkipBack size={18} />
            </button>

            {/* MASTER PLAY / PAUSE CHUNKY BUTTON */}
            <button
              onClick={handlePlayToggle}
              title={isPlaying ? 'Pause' : 'Lecture'}
              aria-label={isPlaying ? 'Pause' : 'Lecture'}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all ${
                isPlaying
                  ? 'bg-gradient-to-b from-[#2e3446] to-[#1a1e28] border-2 border-accent text-accent shadow-[0_0_18px_rgba(245,158,11,0.6)] scale-[0.97]'
                  : 'skeuo-btn text-text-primary hover:text-accent hover:scale-105'
              }`}
              style={{ width: '52px', height: '52px' }}
            >
              {isPlaying ? (
                <Pause size={22} fill="currentColor" />
              ) : (
                <Play size={22} fill="currentColor" className="ml-1" />
              )}
            </button>

            {/* Skip Forward */}
            <button
              onClick={handleNext}
              title="Piste Suivante"
              aria-label="Piste Suivante"
              className="w-10 h-10 rounded-btn skeuo-btn flex items-center justify-center text-text-primary hover:text-accent"
            >
              <SkipForward size={18} />
            </button>

            {/* Repeat Toggle */}
            <button
              onClick={handleRepeat}
              title="Mode Répétition"
              aria-label="Mode Répétition"
              className={`w-10 h-10 rounded-btn flex items-center justify-center transition-all ${
                repeat !== 'off'
                  ? 'skeuo-btn-active text-accent'
                  : 'skeuo-btn text-text-muted hover:text-text-primary'
              }`}
            >
              {repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}
            </button>
          </div>

          {/* Timeline Scrubber in grooved track */}
          <div className="flex-1 flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-text-muted w-11 text-right select-none">
              {formatDuration(currentTime)}
            </span>
            <div className="flex-1">
              <Slider
                value={currentTime}
                max={duration || 1}
                onChange={(val) => seek(val)}
                ariaLabel="Position temporelle"
              />
            </div>
            <span className="font-mono text-xs font-bold text-text-muted w-11 text-left select-none">
              {formatDuration(duration)}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT SECTION: Speed, Timer, Large Volume Knob, Queue */}
      <div className="flex items-center justify-end gap-5 w-1/4 min-w-[280px] z-10">
        {/* Speed Selector */}
        <div className="relative">
          <button
            onClick={() => {
              hapticAudio.playToggleSnap();
              setShowSpeedMenu(!showSpeedMenu);
            }}
            title="Vitesse de défilement de bande"
            aria-label="Vitesse de défilement"
            className={`px-3 py-2 rounded-btn skeuo-btn flex items-center gap-1.5 text-xs font-mono font-extrabold ${
              playbackSpeed !== 1.0 ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Gauge size={15} />
            <span>{playbackSpeed}x</span>
          </button>

          {showSpeedMenu && (
            <div className="absolute bottom-14 right-0 skeuo-panel rounded-xl shadow-2xl py-1.5 z-40 w-28 border border-border">
              {speeds.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    hapticAudio.playToggleSnap();
                    setPlaybackSpeed(s);
                    setShowSpeedMenu(false);
                  }}
                  className={`w-full px-3.5 py-2 text-xs text-left font-mono font-bold transition-colors ${
                    playbackSpeed === s
                      ? 'text-accent bg-surface-plate'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sleep Timer */}
        <div className="relative">
          <button
            onClick={() => {
              hapticAudio.playToggleSnap();
              setShowTimerMenu(!showTimerMenu);
            }}
            title="Minuterie d'extinction"
            aria-label="Minuterie d'extinction"
            className={`p-2.5 rounded-btn skeuo-btn relative ${
              sleepTimerActive ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Timer size={18} />
            {sleepTimerActive && sleepTimer !== null && (
              <span className="absolute -top-1 -right-1 bg-accent text-background font-mono text-[10px] font-bold px-1.5 rounded-full shadow-glow">
                {Math.ceil(sleepTimer / 60)}m
              </span>
            )}
          </button>

          {showTimerMenu && (
            <div className="absolute bottom-14 right-0 skeuo-panel rounded-xl shadow-2xl py-1.5 z-40 w-40 border border-border">
              <div className="px-3.5 py-1 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Minuterie
              </div>
              {timerOptions.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => {
                    hapticAudio.playToggleSnap();
                    setSleepTimer(opt.minutes);
                    setShowTimerMenu(false);
                  }}
                  className="w-full px-3.5 py-2 text-xs text-left text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors font-semibold"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* LARGE 3-LAYER ROTARY MASTER VOLUME KNOB */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              hapticAudio.playToggleSnap();
              toggleMute();
            }}
            aria-label={isMuted ? 'Réactiver le son' : 'Couper le son'}
            className="text-text-muted hover:text-text-primary p-1.5 rounded-btn transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={19} className="text-red-400" />
            ) : volume < 0.5 ? (
              <Volume1 size={19} />
            ) : (
              <Volume2 size={19} />
            )}
          </button>

          <Knob
            value={isMuted ? 0 : volume}
            onChange={(val) => setVolume(val)}
            size={52}
            defaultValue={0.8}
            label={isMuted ? 'MUTE' : `${Math.round(volume * 100)}%`}
          />
        </div>

        {/* Queue Drawer Toggle */}
        <button
          onClick={() => {
            hapticAudio.playToggleSnap();
            onToggleQueue();
          }}
          title="File d'attente"
          aria-label="Afficher la file d'attente"
          className={`p-2.5 rounded-btn relative transition-all ${
            isQueueOpen
              ? 'skeuo-btn-active text-accent'
              : 'skeuo-btn text-text-muted hover:text-text-primary'
          }`}
        >
          <ListMusic size={19} />
          {queue.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-surface-cavity border border-border text-accent font-mono text-[10px] font-bold px-1.5 rounded-full">
              {queue.length}
            </span>
          )}
        </button>
      </div>
    </footer>
  );
};
