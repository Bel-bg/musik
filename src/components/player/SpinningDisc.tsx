import React, { useEffect, useRef } from "react";
import { CoverDisplay } from "./CoverDisplay";
import type { Track } from "@/types";

interface SpinningDiscProps {
  track?: Track | null;
  isPlaying: boolean;
  size?: number;
  onClick?: () => void;
  className?: string;
}

const REV_MS = 5400; // un tour toutes les 5,4 s (≈ 11 tr/min : lisible sans être nerveux)

/**
 * Disque vinyle : sillons + pochette au centre.
 * - La rotation passe par l'API Web Animations (transform seul => compositeur GPU, 0 re-render React).
 * - Play/pause ne coupe pas net : la vitesse monte/descend avec de l'inertie, l'angle est conservé.
 * - Le reflet reste fixe pendant que le disque tourne (c'est ça qui donne le réalisme).
 */
export const SpinningDisc: React.FC<SpinningDiscProps> = ({
  track,
  isPlaying,
  size = 92,
  onClick,
  className = "",
}) => {
  const spinRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);
  const rateRaf = useRef(0);

  useEffect(() => {
    const el = spinRef.current;
    if (!el || typeof el.animate !== "function") return;
    const anim = el.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }],
      { duration: REV_MS, iterations: Infinity, easing: "linear" },
    );
    anim.pause();
    animRef.current = anim;
    return () => {
      anim.cancel();
      animRef.current = null;
    };
  }, []);

  useEffect(() => {
    const anim = animRef.current;
    if (!anim) return;
    cancelAnimationFrame(rateRaf.current);

    const from = anim.playbackRate;
    const to = isPlaying ? 1 : 0;
    const duration = isPlaying ? 700 : 1200;
    const start = performance.now();
    if (isPlaying) anim.play();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      anim.playbackRate = from + (to - from) * eased;
      if (t < 1) rateRaf.current = requestAnimationFrame(tick);
      else if (!isPlaying) anim.pause();
    };
    rateRaf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rateRaf.current);
  }, [isPlaying]);

  const label = size * 0.46;

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={track ? `${track.title} — lecture en cours` : "Disque"}
      className={`relative flex-shrink-0 rounded-full ${onClick ? "cursor-pointer active:scale-[0.97] transition-transform" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: isPlaying
          ? "0 0 24px rgba(255,157,51,0.28), 0 10px 26px rgba(0,0,0,0.7)"
          : "0 10px 26px rgba(0,0,0,0.7)",
        transition: "box-shadow 0.6s ease",
      }}
    >
      {/* Couche qui tourne : sillons + pochette */}
      <div
        ref={spinRef}
        className="absolute inset-0 rounded-full will-change-transform"
        style={{
          background:
            "repeating-radial-gradient(circle at center, #0a0a0d 0px, #0a0a0d 1.5px, #181920 1.5px, #181920 3px)",
        }}
      >
        <div
          className="absolute rounded-full overflow-hidden bg-[#14151a] border border-[#ff9d33]/40"
          style={{
            width: label,
            height: label,
            left: (size - label) / 2,
            top: (size - label) / 2,
          }}
        >
          <CoverDisplay track={track} className="w-full h-full object-cover" />
        </div>
        {/* Axe central */}
        <div
          className="absolute rounded-full bg-[#090a0d] border border-white/20"
          style={{
            width: size * 0.07,
            height: size * 0.07,
            left: (size - size * 0.07) / 2,
            top: (size - size * 0.07) / 2,
          }}
        />
      </div>

      {/* Reflet fixe + liseré */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none border border-white/10"
        style={{
          background:
            "conic-gradient(from 25deg, transparent 0deg, rgba(255,255,255,0.11) 38deg, transparent 80deg, transparent 180deg, rgba(255,255,255,0.07) 218deg, transparent 260deg)",
        }}
      />
    </div>
  );
};
