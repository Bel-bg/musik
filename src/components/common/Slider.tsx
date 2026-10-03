import React, { useRef, useState, useCallback, useEffect } from 'react';

interface SliderProps {
  value: number; // 0 to max
  max: number;
  min?: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  className?: string;
  accentColor?: string;
  ariaLabel?: string;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  max,
  min = 0,
  step = 1,
  onChange,
  onChangeEnd,
  className = '',
  accentColor = '#f59e0b',
  ariaLabel = 'Curseur',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const currentValue = isDragging && dragValue !== null ? dragValue : value;
  const percentage = max > min ? Math.max(0, Math.min(100, ((currentValue - min) / (max - min)) * 100)) : 0;

  const calculateValueFromPointer = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const pos = (clientX - rect.left) / rect.width;
      const clamped = Math.max(0, Math.min(1, pos));
      const rawValue = min + clamped * (max - min);
      const stepped = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, stepped));
    },
    [min, max, step]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const newValue = calculateValueFromPointer(e.clientX);
    setDragValue(newValue);
    onChange(newValue);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newValue = calculateValueFromPointer(e.clientX);
      setDragValue(newValue);
      onChange(newValue);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const finalValue = calculateValueFromPointer(e.clientX);
      setIsDragging(false);
      setDragValue(null);
      if (onChangeEnd) {
        onChangeEnd(finalValue);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, calculateValueFromPointer, onChange, onChangeEnd]);

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentValue}
      tabIndex={0}
      onKeyDown={(e) => {
        const delta = (max - min) * 0.05 || step;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
          e.preventDefault();
          const next = Math.min(max, currentValue + delta);
          onChange(next);
          if (onChangeEnd) onChangeEnd(next);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
          e.preventDefault();
          const prev = Math.max(min, currentValue - delta);
          onChange(prev);
          if (onChangeEnd) onChangeEnd(prev);
        }
      }}
      className={`group relative flex items-center h-4 cursor-pointer select-none touch-none ${className}`}
    >
      {/* Milled Recessed Groove Track */}
      <div className="w-full h-1.5 rounded-full overflow-hidden relative bg-[#07080b] border border-[#1a1d26] shadow-[inset_0_1px_3px_rgba(0,0,0,0.9)]">
        {/* Filled Luminous Amber Track */}
        <div
          className="h-full rounded-full transition-all duration-75 relative"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, #d97706 0%, ${accentColor} 100%)`,
            boxShadow: `0 0 8px ${accentColor}80`,
          }}
        />
      </div>

      {/* Machined Metal Fader Thumb */}
      <div
        className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full pointer-events-none transition-transform ${
          isDragging ? 'scale-125' : 'group-hover:scale-110'
        }`}
        style={{
          left: `calc(${percentage}% - 7px)`,
          background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #cbd2e1 45%, #6a7184 100%)',
          border: '1px solid #1a1e28',
          boxShadow: `
            0 2px 5px rgba(0, 0, 0, 0.8),
            0 0 10px rgba(245, 158, 11, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.9)
          `,
        }}
      >
        {/* Amber center laser dot */}
        <div className="absolute inset-[3.5px] rounded-full bg-accent shadow-[0_0_4px_#f59e0b]" />
      </div>
    </div>
  );
};
