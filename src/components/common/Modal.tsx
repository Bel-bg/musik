import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { hapticAudio } from '@/lib/hapticAudio';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        hapticAudio.playToggleSnap();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              hapticAudio.playToggleSnap();
              onClose();
            }}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Content - Skeuomorphic Faceplate */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`relative skeuo-panel rounded-card p-6 shadow-2xl z-10 w-full max-w-md metal-grain border border-border ${className}`}
          >
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-[#202430]">
              <h2 className="heading-tight text-lg text-text-primary tracking-tight">{title}</h2>
              <button
                onClick={() => {
                  hapticAudio.playToggleSnap();
                  onClose();
                }}
                aria-label="Fermer la fenêtre"
                className="p-1 rounded-btn skeuo-btn text-text-muted hover:text-text-primary"
              >
                <X size={16} />
              </button>
            </div>

            <div className="z-10 relative">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
