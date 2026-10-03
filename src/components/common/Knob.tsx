import React, { useRef, useEffect } from 'react';
import { useRelativeDrag } from '@/hooks/useRelativeDrag';

interface KnobProps {
  value: number; // 0.0 to 1.0
  onChange: (value: number) => void;
  size?: number; // diameter in pixels (default: 60)
  label?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  className?: string;
}

export const Knob: React.FC<KnobProps> = ({
  value,
  onChange,
  size = 60,
  label,
  defaultValue = 0.8,
  min = 0,
  max = 1,
  className = '',
}) => {
  const angleRef = useRef<number>((value - 0.5) * 270);
  const targetAngleRef = useRef<number>((value - 0.5) * 270);
  const indicatorRef = useRef<HTMLDivElement>(null);

  targetAngleRef.current = (value - 0.5) * 270;

  useEffect(() => {
    let animId: number;
    const animate = () => {
      angleRef.current += (targetAngleRef.current - angleRef.current) * 0.28;
      if (indicatorRef.current) {
        indicatorRef.current.style.transform = `rotate(${angleRef.current}deg)`;
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  const { isDragging, listeners } = useRelativeDrag({
    value,
    onChange,
    defaultValue,
    min,
    max,
  });

  return (
    <div className={`flex flex-col items-center select-none group ${className}`}>
      {/* Outer Rotary Container with Cursor Style */}
      <div
        {...listeners}
        title="Glissez verticalement ou utilisez la molette (Shift pour micro-ajustement). Double-clic pour réinitialiser."
        className="relative cursor-ns-resize touch-none flex items-center justify-center p-2"
        style={{ width: size + 20, height: size + 20 }}
      >
        {/* CALQUE 1 (Fixe) : Cavité Fraisée dans la masse & Biseau de fond */}
        <div
          className="absolute rounded-full"
          style={{
            width: size + 10,
            height: size + 10,
            background: 'radial-gradient(circle, #08090d 60%, #151821 100%)',
            boxShadow: `
              inset 0 4px 8px rgba(0, 0, 0, 0.95),
              inset 0 1px 3px rgba(0, 0, 0, 0.8),
              0 1px 0 rgba(255, 255, 255, 0.1)
            `,
          }}
        />

        {/* CALQUE 2 (Fixe) : Face Usinée en Métal Anodisé & Reflet Spéculaire à 45° */}
        <div
          className="absolute rounded-full"
          style={{
            width: size,
            height: size,
            background: `
              radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 55%),
              linear-gradient(135deg, #303648 0%, #1d212b 45%, #141720 100%)
            `,
            boxShadow: `
              0 6px 14px rgba(0, 0, 0, 0.8),
              0 2px 4px rgba(0, 0, 0, 0.6),
              inset 0 1px 0 rgba(255, 255, 255, 0.25),
              inset 0 -1px 0 rgba(0, 0, 0, 0.7)
            `,
          }}
        >
          {/* Micro-cannelures / concentric machined ridges ring */}
          <div
            className="absolute inset-[4px] rounded-full border border-white/[0.06]"
            style={{
              background: 'radial-gradient(circle, #181b24 50%, #222635 100%)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.6)',
            }}
          />
        </div>

        {/* CALQUE 3 (En Rotation Pure) : Index & Ligne Ambrée Phosphorescente */}
        <div
          ref={indicatorRef}
          className="absolute inset-0 pointer-events-none flex items-center justify-center will-change-transform"
        >
          <div
            className="absolute rounded-full"
            style={{
              top: 8,
              width: 4,
              height: 12,
              background: '#f59e0b',
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.9), 0 0 16px rgba(245, 158, 11, 0.5)',
            }}
          />
        </div>

        {/* Halo feedback when dragging */}
        {isDragging && (
          <div
            className="absolute rounded-full border-2 border-accent pointer-events-none animate-pulse"
            style={{ width: size + 12, height: size + 12 }}
          />
        )}
      </div>

      {/* Label and Value readout below */}
      {label && (
        <span className="text-xs font-mono font-bold text-accent tracking-wider mt-0.5">
          {label}
        </span>
      )}
    </div>
  );
};
