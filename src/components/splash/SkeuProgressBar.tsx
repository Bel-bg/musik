import React, { memo, useRef } from "react";
import {
  motion,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "framer-motion";

/* -------------------------------------------------------------------------- */
/*  Styles skeuomorphiques (autonomes, préfixe skeu-pg- pour éviter les        */
/*  collisions avec la barre de titre)                                         */
/* -------------------------------------------------------------------------- */

const PROGRESS_CSS = `
/* Façade : métal brossé, biseau clair en haut, ombre portée profonde */
.skeu-pg-plate {
  position: relative;
  width: min(520px, 88vw);
  padding: 16px 20px 14px;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.85);
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #363a47 0%, #24262f 48%, #1a1c24 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -2px 0 rgba(0,0,0,0.55),
    inset 1px 0 0 rgba(255,255,255,0.05),
    inset -1px 0 0 rgba(0,0,0,0.3),
    0 2px 0 #0b0c11,
    0 6px 10px rgba(0,0,0,0.5),
    0 22px 38px rgba(0,0,0,0.7);
}

/* Vis de fixation, chacune avec sa fente orientée différemment */
.skeu-pg-screw {
  position: absolute;
  width: 11px;
  height: 11px;
  border-radius: 9999px;
  background:
    linear-gradient(var(--a, 45deg), rgba(0,0,0,0) 44%, rgba(0,0,0,0.8) 44% 56%, rgba(0,0,0,0) 56%),
    radial-gradient(circle at 35% 30%, #9a9eae 0%, #4a4d5a 55%, #2a2c35 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.4),
    0 1px 1px rgba(0,0,0,0.85),
    0 0 0 1px rgba(0,0,0,0.65),
    0 0 0 3px rgba(0,0,0,0.22);
}

/* En-tête : voyant + gravure à gauche, afficheur à droite */
.skeu-pg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 14px;
}
.skeu-pg-left { display: flex; align-items: center; gap: 12px; }

/* Voyant à cabochon */
.skeu-pg-lamp {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: radial-gradient(circle at 35% 30%, #fff0cf 0%, #ffb347 30%, #e06a00 70%, #8a3d00 100%);
  box-shadow:
    0 0 0 2px #14151b,
    0 0 0 3px rgba(255,255,255,0.12),
    0 0 10px 2px rgba(255,157,51,0.75);
  animation: skeu-pg-lamp 1.4s ease-in-out infinite;
}
@keyframes skeu-pg-lamp {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(0.7); }
}

/* Texte gravé dans le métal */
.skeu-pg-engraved {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #0d0e13;
  text-shadow: 0 1px 0 rgba(255,255,255,0.16), 0 -1px 0 rgba(0,0,0,0.6);
}

/* Afficheur : fenêtre en retrait, chiffres ambrés lumineux */
.skeu-pg-lcd {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 6px 11px 5px;
  border-radius: 7px;
  overflow: hidden;
  border: 1px solid #000;
  background: linear-gradient(180deg, #050403 0%, #130d06 100%);
  box-shadow:
    inset 0 3px 7px rgba(0,0,0,0.95),
    inset 0 -1px 0 rgba(255,255,255,0.07),
    0 1px 0 rgba(255,255,255,0.16);
}
.skeu-pg-lcd::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 45%);
}
.skeu-pg-digits-wrap {
  position: relative;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}
.skeu-pg-digits-ghost { color: rgba(255,157,51,0.08); }
.skeu-pg-digits {
  position: absolute;
  inset: 0;
  text-align: right;
  color: #ffb347;
  text-shadow: 0 0 8px rgba(255,157,51,0.85), 0 0 2px rgba(255,200,120,0.9);
}
.skeu-pg-unit {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  color: rgba(255,157,51,0.75);
  text-shadow: 0 0 6px rgba(255,157,51,0.6);
}

/* Cadre chromé en relief autour de la rainure */
.skeu-pg-slot {
  position: relative;
  isolation: isolate;
  padding: 5px;
  border-radius: 20px;
  border: 1px solid rgba(0,0,0,0.8);
  background: linear-gradient(180deg, #5d6171 0%, #2c2e38 50%, #15161c 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -1px 0 rgba(0,0,0,0.6),
    0 2px 0 #0b0c11,
    0 6px 10px rgba(0,0,0,0.5);
}

/* Halo ambré qui monte avec la progression */
.skeu-pg-halo {
  position: absolute;
  inset: -6px;
  z-index: -1;
  border-radius: 26px;
  background: #ff9d33;
  filter: blur(16px);
  pointer-events: none;
}

/* Rainure en creux */
.skeu-pg-groove {
  position: relative;
  height: 28px;
  border-radius: 14px;
  background: #040507;
  box-shadow:
    inset 0 4px 9px rgba(0,0,0,1),
    inset 0 -1px 0 rgba(255,255,255,0.06),
    inset 0 0 0 1px rgba(0,0,0,0.9),
    0 1px 0 rgba(255,255,255,0.18);
}
.skeu-pg-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
}
.skeu-pg-rail {
  position: absolute;
  inset: 5px 14px;
}

/* Cellules éteintes */
.skeu-pg-cells {
  position: absolute;
  inset: 0;
  border-radius: 3px;
  background: repeating-linear-gradient(90deg, rgba(255,150,40,0.13) 0 8px, rgba(0,0,0,0) 8px 11px);
}

/* Cellules allumées : tube ambré découpé en segments par un masque */
.skeu-pg-lit-wrap {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  overflow: hidden;
  filter: drop-shadow(0 0 6px rgba(255,150,40,0.9));
}
.skeu-pg-lit {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #ffe2a8 0%, #ffb347 22%, #ff8a1a 55%, #c24e00 100%);
  -webkit-mask-image: repeating-linear-gradient(90deg, #000 0 8px, transparent 8px 11px);
  mask-image: repeating-linear-gradient(90deg, #000 0 8px, transparent 8px 11px);
}

/* Vitre bombée par-dessus : reflet haut + reflet en biais */
.skeu-pg-glass {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.07) 42%, rgba(255,255,255,0) 52%, rgba(255,255,255,0.04) 100%),
    linear-gradient(100deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.10) 38%, rgba(255,255,255,0) 46%);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
}

/* Curseur de console : cylindre métal strié avec repère ambré lumineux */
.skeu-pg-travel {
  position: absolute;
  inset: 0 14px;
  pointer-events: none;
}
.skeu-pg-fader {
  position: absolute;
  top: 50%;
  width: 28px;
  height: 50px;
  border-radius: 7px;
  border: 1px solid #000;
  background:
    repeating-linear-gradient(180deg, rgba(255,255,255,0) 0 3px, rgba(0,0,0,0.28) 3px 4px, rgba(255,255,255,0.1) 4px 5px),
    linear-gradient(90deg, #13141b 0%, #484c5a 16%, #6b7084 30%, #3b3e4a 55%, #2a2c35 80%, #101117 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    inset 0 -2px 3px rgba(0,0,0,0.5),
    0 3px 0 #0b0c11,
    0 9px 12px rgba(0,0,0,0.75);
}
.skeu-pg-fader::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 5px;
  bottom: 5px;
  width: 3px;
  transform: translateX(-50%);
  border-radius: 2px;
  background: linear-gradient(180deg, #ffd9a0, #ff9d33);
  box-shadow: 0 0 8px 1px rgba(255,157,51,0.9), 0 0 0 1px rgba(0,0,0,0.6);
}

/* Échelle gravée sous la rainure */
.skeu-pg-scale {
  position: relative;
  height: 26px;
  margin: 12px 19px 0;
}
.skeu-pg-tick {
  position: absolute;
  top: 0;
  width: 1px;
  height: 5px;
  transform: translateX(-50%);
  background: #0b0c11;
  box-shadow: 1px 0 0 rgba(255,255,255,0.14);
}
.skeu-pg-tick--major { width: 2px; height: 10px; }
.skeu-pg-tick-label {
  position: absolute;
  top: 13px;
  transform: translateX(-50%);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  color: #0d0e13;
  text-shadow: 0 1px 0 rgba(255,255,255,0.15);
}

@media (prefers-reduced-motion: reduce) {
  .skeu-pg-lamp { animation: none; }
}
`;

const PROGRESS_STYLE_ID = "skeu-progress-styles";

if (typeof document !== "undefined") {
  const el =
    (document.getElementById(PROGRESS_STYLE_ID) as HTMLStyleElement | null) ??
    Object.assign(document.createElement("style"), { id: PROGRESS_STYLE_ID });
  el.textContent = PROGRESS_CSS; // réécrit à chaque HMR
  if (!el.isConnected) document.head.appendChild(el);
}

/* -------------------------------------------------------------------------- */
/*  Données                                                                    */
/* -------------------------------------------------------------------------- */

// Un cran tous les 5 %, un grand cran gravé avec son chiffre tous les 25 %.
const TICKS = Array.from({ length: 21 }, (_, i) => i * 5);

const SCREWS: React.CSSProperties[] = [
  { top: 8, left: 8, ["--a" as string]: "30deg" },
  { top: 8, right: 8, ["--a" as string]: "110deg" },
  { bottom: 8, left: 8, ["--a" as string]: "75deg" },
  { bottom: 8, right: 8, ["--a" as string]: "155deg" },
];

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/* -------------------------------------------------------------------------- */
/*  Composant                                                                  */
/*                                                                             */
/*  Piloté par un MotionValue (0 à 100) : aucune mise à jour React par frame,  */
/*  le DOM est modifié directement pour ne pas faire ramer la spirale.         */
/* -------------------------------------------------------------------------- */

interface SkeuProgressBarProps {
  value: MotionValue<number>;
  label?: string;
}

export const SkeuProgressBar: React.FC<SkeuProgressBarProps> = memo(
  ({ value, label = "Chargement" }) => {
    const plateRef = useRef<HTMLDivElement>(null);
    const digitsRef = useRef<HTMLSpanElement>(null);

    const width = useTransform(value, (v) => `${clamp(v)}%`);
    const haloOpacity = useTransform(value, [0, 100], [0.08, 0.55]);

    useMotionValueEvent(value, "change", (v) => {
      const n = Math.round(clamp(v));
      if (digitsRef.current) {
        digitsRef.current.textContent = String(n).padStart(3, "0");
      }
      plateRef.current?.setAttribute("aria-valuenow", String(n));
    });

    return (
      <div
        ref={plateRef}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        className="skeu-pg-plate select-none"
      >
        {SCREWS.map((style, i) => (
          <span key={i} aria-hidden className="skeu-pg-screw" style={style} />
        ))}

        <div className="skeu-pg-header">
          <div className="skeu-pg-left">
            <span aria-hidden className="skeu-pg-lamp" />
            <span className="skeu-pg-engraved">{label}</span>
          </div>

          <div className="skeu-pg-lcd" aria-hidden>
            <span className="skeu-pg-digits-wrap">
              <span className="skeu-pg-digits-ghost">888</span>
              <span ref={digitsRef} className="skeu-pg-digits">
                000
              </span>
            </span>
            <span className="skeu-pg-unit">%</span>
          </div>
        </div>

        <div className="skeu-pg-slot">
          <motion.div
            aria-hidden
            className="skeu-pg-halo"
            style={{ opacity: haloOpacity }}
          />

          <div className="skeu-pg-groove">
            <div className="skeu-pg-clip">
              <div className="skeu-pg-rail">
                <div className="skeu-pg-cells" />
                <motion.div className="skeu-pg-lit-wrap" style={{ width }}>
                  <div className="skeu-pg-lit" />
                </motion.div>
              </div>
              <div className="skeu-pg-glass" />
            </div>

            <div className="skeu-pg-travel">
              <motion.div
                className="skeu-pg-fader"
                style={{ left: width, x: "-50%", y: "-50%" }}
              />
            </div>
          </div>
        </div>

        <div className="skeu-pg-scale" aria-hidden>
          {TICKS.map((t) => {
            const major = t % 25 === 0;
            return (
              <React.Fragment key={t}>
                <span
                  className={major ? "skeu-pg-tick skeu-pg-tick--major" : "skeu-pg-tick"}
                  style={{ left: `${t}%` }}
                />
                {major && (
                  <span className="skeu-pg-tick-label" style={{ left: `${t}%` }}>
                    {t}
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }
);

SkeuProgressBar.displayName = "SkeuProgressBar";
