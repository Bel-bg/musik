import React from 'react';

interface EqualizerBarsProps {
  isPlaying: boolean;
  className?: string;
}

export const EqualizerBars: React.FC<EqualizerBarsProps> = ({
  isPlaying,
  className = '',
}) => {
  if (!isPlaying) {
    return (
      <div className={`flex items-end gap-[3px] h-4 w-4 justify-center ${className}`}>
        <span className="w-[3px] h-2 bg-accent/40 rounded-full" />
        <span className="w-[3px] h-3 bg-accent/40 rounded-full" />
        <span className="w-[3px] h-1.5 bg-accent/40 rounded-full" />
      </div>
    );
  }

  return (
    <div
      className={`flex items-end gap-[3px] h-4 w-4 justify-center ${className}`}
      aria-label="Lecture en cours"
    >
      <span className="w-[3px] bg-accent rounded-full eq-bar-1 shadow-[0_0_6px_#f59e0b]" />
      <span className="w-[3px] bg-accent rounded-full eq-bar-2 shadow-[0_0_6px_#f59e0b]" />
      <span className="w-[3px] bg-accent rounded-full eq-bar-3 shadow-[0_0_6px_#f59e0b]" />
    </div>
  );
};
