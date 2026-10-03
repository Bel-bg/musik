import React from 'react';

interface ProgressRingProps {
  progress: number; // 0 to 100
  size?: number;
  strokeWidth?: number;
  children: React.ReactNode;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  strokeWidth = 3,
  children,
  className = '',
}) => {
  const clampedProgress = Math.max(0, Math.min(100, isNaN(progress) ? 0 : progress));

  // Conic gradient style
  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(#1db954 ${clampedProgress * 3.6}deg, #222228 ${clampedProgress * 3.6}deg 360deg)`,
    padding: `${strokeWidth}px`,
    borderRadius: '18px',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center transition-all duration-150 ${className}`}
      style={ringStyle}
    >
      <div className="overflow-hidden rounded-[15px] w-full h-full bg-surface">
        {children}
      </div>
    </div>
  );
};
