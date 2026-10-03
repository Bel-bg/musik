import React, { useRef, useEffect } from 'react';
import { audioAnalysis } from '@/lib/audioAnalysis';

interface VuMeterCanvasProps {
  isPlaying: boolean;
  width?: number;
  height?: number;
  className?: string;
}

export const VuMeterCanvas: React.FC<VuMeterCanvasProps> = ({
  isPlaying,
  width = 210,
  height = 54,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const segmentCount = 16;
    const barWidth = 6.5;
    const barSpacing = 3;
    const startX = 36;

    const render = () => {
      const { left, right, peakLeft, peakRight } = audioAnalysis.getLevels(isPlaying);

      ctx.clearRect(0, 0, width, height);

      // Channel L and Channel R labels
      ctx.font = '700 10px "DM Mono", monospace';
      ctx.fillStyle = '#7a8299';
      ctx.textAlign = 'right';
      ctx.fillText('CH 1', startX - 8, 22);
      ctx.fillText('CH 2', startX - 8, 42);

      // Render L bar & R bar
      const renderChannel = (level: number, peak: number, y: number) => {
        const activeSegments = Math.round(level * segmentCount);
        const peakSegment = Math.min(segmentCount - 1, Math.round(peak * segmentCount));

        for (let i = 0; i < segmentCount; i++) {
          const x = startX + i * (barWidth + barSpacing);
          const isActive = i < activeSegments;
          const isPeak = i === peakSegment && peak > 0.04;

          let color: string;
          let glowColor: string;
          if (i >= segmentCount - 2) {
            // Overload / Clip red (> 0 dB)
            color = isActive || isPeak ? '#ef4444' : '#2b1418';
            glowColor = 'rgba(239, 68, 68, 0.8)';
          } else if (i >= segmentCount - 6) {
            // Amber warm zone (-3 to 0 dB)
            color = isActive || isPeak ? '#f59e0b' : '#2d1e0d';
            glowColor = 'rgba(245, 158, 11, 0.7)';
          } else {
            // Nominal green/cyan zone (-20 to -4 dB)
            color = isActive || isPeak ? '#10b981' : '#0c221a';
            glowColor = 'rgba(16, 185, 129, 0.7)';
          }

          ctx.fillStyle = color;
          if (isActive || isPeak) {
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 6;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, 11, 2);
          ctx.fill();
        }
      };

      ctx.shadowBlur = 0;

      renderChannel(left, peakLeft, 12);
      renderChannel(right, peakRight, 32);

      // Calibration ticks at top
      ctx.font = '600 8px "DM Mono", monospace';
      ctx.fillStyle = '#555d72';
      ctx.textAlign = 'center';
      ctx.fillText('-24', startX + 4, 8);
      ctx.fillText('-12', startX + 5 * (barWidth + barSpacing), 8);
      ctx.fillText('-3', startX + 9 * (barWidth + barSpacing), 8);
      ctx.fillText('0', startX + 12 * (barWidth + barSpacing), 8);
      ctx.fillText('+3', startX + (segmentCount - 1) * (barWidth + barSpacing), 8);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, width, height]);

  return (
    <div
      className={`relative rounded-lg skeuo-recessed p-2 flex items-center justify-center border border-border/80 ${className}`}
      style={{ width: width + 18, height: height + 16 }}
    >
      <canvas
        ref={canvasRef}
        style={{ width, height }}
        className="block"
      />
    </div>
  );
};
