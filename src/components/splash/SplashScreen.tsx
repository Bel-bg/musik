import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import InfiniteSpiral from "../InfiniteSpiral";
import FoldText from "../FoldText";

interface SplashScreenProps {
  onComplete: () => void;
  isDataLoaded?: boolean;
}

const SPIRAL_IMAGES = [
  { src: "/pics/1.jpg", alt: "Album cover" },
  { src: "/pics/2.jpg", alt: "Musik Vinyl" },
  { src: "/pics/3.jpg", alt: "Hi-Fi Reel" },
  { src: "/pics/4.jpg", alt: "Tape Master" },
  { src: "/pics/5.jpg", alt: "Vinyl Record" },
  { src: "/pics/6.jpg", alt: "Audio Console" },
  { src: "/pics/7.jpg", alt: "Vinyl Sleeve" },
  { src: "/pics/8.jpg", alt: "Audiophile Sound" },
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
}) => {
  const [showTitle, setShowTitle] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // À t ≈ 1s : apparition du nom de l'application avec FoldText
    const titleTimer = setTimeout(() => {
      setShowTitle(true);
    }, 1000);

    // À t = 3s : fin du splashscreen (durée totale 3 secondes)
    const finishTimer = setTimeout(() => {
      setIsClosing(true);
      const exitTimer = setTimeout(onComplete, 500);
      return () => clearTimeout(exitTimer);
    }, 3000);

    return () => {
      clearTimeout(titleTimer);
      clearTimeout(finishTimer);
    };
  }, [onComplete]);

  const handleQuickDismiss = () => {
    setIsClosing(true);
    setTimeout(onComplete, 200);
  };

  return (
    <AnimatePresence>
      {!isClosing && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onClick={handleQuickDismiss}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#07080b] text-white select-none overflow-hidden cursor-pointer"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 60% 50% at 30% 50%, rgba(245, 158, 11, 0.09) 0%, transparent 70%),
              radial-gradient(circle at 50% 50%, #11131a 0%, #07080b 100%)
            `,
          }}
        >
          {/* Subtle audio studio ambient grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.15) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          />

          <div className="w-full max-w-5xl h-full flex flex-col md:flex-row items-center justify-center px-8 gap-8 md:gap-16 relative z-10">
            {/* Colonne gauche : Spirale infinie 3D (commence dès 0s) */}
            <div className="w-full md:w-1/2 h-[320px] sm:h-[400px] md:h-[500px] relative flex items-center justify-center">
              <InfiniteSpiral
                items={SPIRAL_IMAGES}
                animationMode="auto"
                speed={0.65}
                radius={150}
                cardWidth={96}
                cardHeight={96}
                verticalSpacing={56}
                perspective={1000}
                cardRadius={12}
                centerScale={1.25}
                edgeBlur={5}
                cardsPerTurn={6}
                pauseOnHover={false}
                direction="up"
                rotation={-8}
                cardTilt={4}
                edgeFade={0.32}
                imageFit="cover"
                grayscale={0}
                className="w-full h-full"
              />
            </div>

            {/* Colonne droite : Nom de l'appli apparaissant à ~1s avec FoldText */}
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start justify-center min-h-[160px]">
              {showTitle && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="flex flex-col items-center md:items-start"
                >
                  <FoldText
                    text="MUSIK"
                    splitBy="char"
                    hinge="top"
                    trigger="mount"
                    duration={0.7}
                    stagger={0.06}
                    ease="power3.out"
                    perspective={800}
                    creaseShading={0.55}
                    fontSize={76}
                    fontWeight={900}
                    color="#f59e0b"
                    className="tracking-widest uppercase"
                  />

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                    className="mt-4 flex items-center gap-3"
                  >
                    <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-amber-500/60" />
                    <span className="text-xs sm:text-sm font-mono tracking-[0.3em] uppercase text-neutral-400 font-semibold">
                      Lecteur Audio
                    </span>
                    <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-amber-500/60" />
                  </motion.div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
