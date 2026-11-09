import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, animate, useMotionValue } from "framer-motion";
import ElasticMesh from "./ElasticMesh";
import { SkeuProgressBar } from "./SkeuProgressBar";

interface SplashScreenProps {
  onComplete: () => void;
  isDataLoaded?: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [isClosing, setIsClosing] = useState(false);

  // Progression 0 à 100, hors du state React pour ne pas re-render le mesh.
  const progress = useMotionValue(0);

  useEffect(() => {
    // Atteint 100 % à 2,6s : la barre reste pleine ~0,4s avant la fermeture.
    const controls = animate(progress, 100, {
      duration: 2.6,
      ease: [0.45, 0.05, 0.25, 1],
    });
    return () => controls.stop();
  }, [progress]);

  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout> | undefined;

    // À t = 3s : fermeture automatique, puis onComplete après l'animation de sortie.
    const finishTimer = setTimeout(() => {
      setIsClosing(true);
      exitTimer = setTimeout(onComplete, 500);
    }, 3000);

    return () => {
      clearTimeout(finishTimer);
      if (exitTimer) clearTimeout(exitTimer);
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
          {/* stopPropagation : attraper/étirer le mesh ne doit pas fermer le splash */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl h-[460px] mb-36 cursor-grab active:cursor-grabbing"
          >
            <ElasticMesh
              src="/logo.svg"
              material="chrome"
              imageColors={false}
              grabRadius={70}
              stretch={0.5}
              press={0.5}
              shadow={0.5}
              intro
            />
          </div>

          {/* Barre de progression skeuomorphique, centrée en bas */}
          <div className="absolute inset-x-0 bottom-8 z-20 flex justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <SkeuProgressBar value={progress} label="Chargement" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};