import { useRef, useState, useCallback } from 'react';
import { hapticAudio } from '@/lib/hapticAudio';

interface UseRelativeDragOptions {
  value: number; // Current value (0.0 to 1.0)
  onChange: (value: number) => void;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  sensitivity?: number; // Total pixels for full range
  notchStep?: number; // Step for audio ratchet clicks
}

export function useRelativeDrag({
  value,
  onChange,
  defaultValue = 0.8,
  min = 0,
  max = 1,
  sensitivity = 140,
  notchStep = 0.05,
}: UseRelativeDragOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValRef = useRef<number>(value);
  const currentValRef = useRef<number>(value);
  const lastNotchRef = useRef<number>(Math.round(value / notchStep));

  currentValRef.current = value;

  const clamp = (val: number) => Math.max(min, Math.min(max, val));

  const checkNotch = (newVal: number) => {
    const currentNotch = Math.round(newVal / notchStep);
    if (currentNotch !== lastNotchRef.current) {
      lastNotchRef.current = currentNotch;
      hapticAudio.playRatchetTick();
    }
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // Left click only
      e.preventDefault();
      setIsDragging(true);
      startYRef.current = e.clientY;
      startValRef.current = currentValRef.current;
      lastNotchRef.current = Math.round(currentValRef.current / notchStep);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const deltaY = startYRef.current - moveEvent.clientY;
        const deltaVal = deltaY / sensitivity;
        const nextVal = clamp(startValRef.current + deltaVal);
        checkNotch(nextVal);
        onChange(nextVal);
      };

      const onPointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    [onChange, sensitivity, notchStep]
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      // If Shift key is held, apply micro-tuning (divide step by 5)
      const divider = e.shiftKey ? 2500 : 500;
      const delta = -e.deltaY / divider;
      const nextVal = clamp(currentValRef.current + delta);
      checkNotch(nextVal);
      onChange(nextVal);
    },
    [onChange, notchStep]
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      hapticAudio.playToggleSnap();
      onChange(defaultValue);
    },
    [defaultValue, onChange]
  );

  return {
    isDragging,
    listeners: {
      onPointerDown,
      onWheel,
      onDoubleClick,
    },
  };
}
