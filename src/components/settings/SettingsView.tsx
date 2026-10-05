import React, { useState, useEffect } from "react";
import {
  Trash2,
  Check,
} from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { tauriApi, openExternalUrl } from "@/lib/tauri";
import { hapticAudio } from "@/lib/hapticAudio";
import type { AppSettings } from "@/types";

export const SettingsView: React.FC = () => {
  const {
    watchedFolders,
    removeWatchedFolder,
    rescan,
    isScanning,
  } = useLibraryStore();

  const [settings, setSettings] = useState<AppSettings>({
    volume: 0.8,
    is_muted: false,
    shuffle: false,
    repeat: "off",
    last_track_id: null,
    last_position: 0,
    playback_speed: 1.0,
    restore_last_track_on_startup: true,
    restore_last_view_on_startup: true,
    media_keys_enabled: true,
    version: "1.0.0",
  });

  const [hapticsEnabled, setHapticsEnabled] = useState(
    hapticAudio.getEnabled(),
  );
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    tauriApi.getSettings().then((res) => {
      setSettings((prev) => ({ ...prev, ...res }));
    });
  }, []);

  const handleToggleSetting = async (key: keyof AppSettings) => {
    hapticAudio.playToggleSnap();
    const nextVal = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: nextVal }));
    await tauriApi.saveSetting(key, String(nextVal));
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2000);
  };

  const handleToggleHaptics = () => {
    const next = !hapticsEnabled;
    hapticAudio.setEnabled(next);
    setHapticsEnabled(next);
    if (next) {
      hapticAudio.playHeavySwitch();
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto select-none">
      {/* Title with Studio Calibration Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-text-primary heading-tight">
          Paramètres du lecteur
        </h1>
        {savedFeedback && (
          <div className="flex items-center gap-1.5 text-xs text-accent vfd-glow font-mono font-bold">
            <Check size={14} />
            <span>Paramètres sauvegardés sur le support local.</span>
          </div>
        )}
      </div>

      {/* Watched Folders Panel */}
      <div className="skeuo-panel rounded-card p-6 flex flex-col gap-4 metal-grain">
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <h2 className="heading-tight text-lg text-text-primary">
              Dossiers de stockage surveillés
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                hapticAudio.playHeavySwitch();
                rescan();
              }}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 skeuo-btn rounded-btn text-xs font-bold text-text-primary disabled:opacity-50"
            >
              <span>
                {isScanning ? "Actualisation en cours..." : "Actualiser"}
              </span>
            </button>
          </div>
        </div>

        <p className="text-xs text-text-muted z-10 leading-relaxed font-medium">
          Les fichiers audio des répertoires enregistrés sont indexés localement
          sans connexion Internet.
        </p>

        {watchedFolders.length === 0 ? (
          <div className="py-8 text-center skeuo-recessed rounded-lg text-text-subtle text-xs font-mono uppercase tracking-wider z-10">
            Aucun dossier configuré. Cliquez sur "Ajouter un dossier" pour
            indexer votre playlist.
          </div>
        ) : (
          <div className="flex flex-col gap-2 z-10">
            {watchedFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-3 rounded-lg skeuo-recessed border border-border"
              >
                <div className="flex flex-col min-w-0 pr-4">
                  <span className="font-mono text-xs text-text-primary truncate font-bold">
                    {folder.path}
                  </span>
                </div>

                <button
                  onClick={() => {
                    hapticAudio.playToggleSnap();
                    removeWatchedFolder(folder.id);
                  }}
                  title="Retirer ce dossier"
                  className="p-1.5 rounded skeuo-btn text-text-muted hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tactile Hardware Sound & Preferences */}
      <div className="skeuo-panel rounded-card p-6 flex flex-col gap-4 metal-grain">
        <h2 className="heading-tight text-lg text-text-primary z-10">
          Comportement physique & Démarrage
        </h2>

        <div className="flex flex-col gap-3 z-10">
          {/* Mechanical Sound Effects Toggle */}
          <label className="flex items-center justify-between p-3 rounded-lg skeuo-recessed cursor-pointer border border-border hover:border-accent/30 transition-colors">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-primary">
                  Skeuomorphisme Sonore & Clics Mécaniques
                </span>
              </div>
              <span className="text-xs text-text-muted mt-0.5">
                Simule les relais solénoïdes, interrupteurs et crans de
                potentiomètres en temps réel via Web Audio.
              </span>
            </div>
            <input
              type="checkbox"
              checked={hapticsEnabled}
              onChange={handleToggleHaptics}
              className="accent-accent w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg skeuo-recessed cursor-pointer border border-border hover:border-accent/30 transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text-primary">
                Restaurer la dernière piste lue
              </span>
              <span className="text-xs text-text-muted mt-0.5">
                Rétablit l'aiguille de position exacte au lancement sans
                démarrer la lecture automatiquement.
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.restore_last_track_on_startup}
              onChange={() =>
                handleToggleSetting("restore_last_track_on_startup")
              }
              className="accent-accent w-4 h-4 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg skeuo-recessed cursor-pointer border border-border hover:border-accent/30 transition-colors">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text-primary">
                Intégration des touches multimédias
              </span>
              <span className="text-xs text-text-muted mt-0.5">
                Contrôle la lecture avec le clavier système (Play, Pause, Piste
                suivante/précédente).
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.media_keys_enabled}
              onChange={() => handleToggleSetting("media_keys_enabled")}
              className="accent-accent w-4 h-4 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="skeuo-panel rounded-card p-6 flex flex-col gap-4 metal-grain">
        <div className="flex items-center gap-2 z-10">
          <h2 className="heading-tight text-lg text-text-primary">
            Raccourcis clavier studio
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs z-10">
          <div className="flex items-center justify-between p-2 rounded skeuo-recessed border border-border font-medium">
            <span className="text-text-muted">Lecture / Pause</span>
            <kbd className="px-2 py-0.5 rounded skeuo-btn font-mono text-accent font-bold">
              Espace
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded skeuo-recessed border border-border font-medium">
            <span className="text-text-muted">Recherche globale</span>
            <kbd className="px-2 py-0.5 rounded skeuo-btn font-mono text-accent font-bold">
              Ctrl + K
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded skeuo-recessed border border-border font-medium">
            <span className="text-text-muted">Reculer de 5 secondes</span>
            <kbd className="px-2 py-0.5 rounded skeuo-btn font-mono text-accent font-bold">
              Flèche Gauche
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded skeuo-recessed border border-border font-medium">
            <span className="text-text-muted">Avancer de 5 secondes</span>
            <kbd className="px-2 py-0.5 rounded skeuo-btn font-mono text-accent font-bold">
              Flèche Droite
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded skeuo-recessed border border-border font-medium">
            <span className="text-text-muted">Ajuster le volume</span>
            <kbd className="px-2 py-0.5 rounded skeuo-btn font-mono text-accent font-bold">
              Flèches Haut / Bas
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded skeuo-recessed border border-border font-medium">
            <span className="text-text-muted">Couper / Réactiver le son</span>
            <kbd className="px-2 py-0.5 rounded skeuo-btn font-mono text-accent font-bold">
              M
            </kbd>
          </div>
        </div>
      </div>

      {/* Privacy Policy */}
      <div className="skeuo-panel rounded-card p-6 flex flex-col gap-3 metal-grain">
        <div className="flex items-center gap-2 z-10">
          <h2 className="heading-tight text-lg text-text-primary">
            Confidentialité 
          </h2>
        </div>

        <div className="text-xs text-text-muted leading-relaxed space-y-2 skeuo-recessed p-4 rounded-lg border border-border z-10">
          <p>
            Bon, bon moi même j'ai pas l'argent pour héberger serveur qui va voler vos donner d'abord...😒😒😒
            Bref tout est en local sur vôtre PC. Dès qu'il y a mise à jour de vous informe y'ai pas le temps d'écrire de longue close de Confidentialité aussi j'ai pas forcé quelqu'un a installer mon chef d'oeuvre esthétique ! 😏
          </p>
        </div>
      </div>

      {/* Footer / About App */}
      
    <footer className="mt-auto w-full shrink-0 border-t border-white/10 px-4 py-6">
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        {/* Logo et Version */}
        <div className="flex flex-col items-center gap-3">
          <img 
            src="/musik.png" 
            alt="MUSIK Logo" 
            className="h-28 sm:h-36 md:h-44 w-auto max-w-full object-contain rounded-sm" 
          />
          <span className="font-mono-numbers text-accent text-sm font-bold leading-none">
            v{settings.version || "1.0.0"}
          </span>
        </div>

        {/* Crédits avec Avatar et Lien */}
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>
            made by{" "}
            <a 
              href="https://github.com/Bel-bg" 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={(e) => {
                e.preventDefault();
                hapticAudio.playToggleSnap();
                openExternalUrl("https://github.com/Bel-bg");
              }}
              className="font-medium text-foreground transition-colors hover:text-primary underline underline-offset-4 cursor-pointer"
            >
              bel.dev
            </a>
          </span>
        </p>
      </div>
    </footer>

    </div>
  );
};
