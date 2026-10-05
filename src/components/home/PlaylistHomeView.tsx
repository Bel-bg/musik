import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, ListMusic, FolderOpen, ArrowLeft, Settings } from "lucide-react";
import { usePlaylistStore } from "@/store/usePlaylistStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { selectImageFile, tauriApi } from "@/lib/tauri";
import { hapticAudio } from "@/lib/hapticAudio";
import type { Playlist } from "@/types";
import { VinylPlaylistCard } from "./VinylPlaylistCard";
import { SettingsView } from "@/components/settings/SettingsView";

const GithubIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 16,
  className,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);

/* -------------------------------------------------------------------------- */
/*  Styles skeuomorphiques (autonomes)                                         */
/*  Lumière en haut : liseré clair sur les reliefs, sombre sur les creux.      */
/* -------------------------------------------------------------------------- */

const SLIDE_MS = 320;

const PLAYLIST_HOME_CSS = `
/* ---------- Châssis (remplace l'image de fond) ---------- */
.skeu-chassis {
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #181a21 0%, #101218 100%);
}

/* ---------- Glissade : le panneau remplace la grille ---------- */
.skeu-pane {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  transition: transform ${SLIDE_MS}ms cubic-bezier(0.22, 0.8, 0.3, 1), visibility 0s;
}
.skeu-pane[data-state="left"]  { transform: translateX(-100%); }
.skeu-pane[data-state="right"] { transform: translateX(100%); }
/* Le volet inactif devient invisible (donc hors tabulation) une fois la glissade finie */
.skeu-pane[data-state="left"],
.skeu-pane[data-state="right"] {
  visibility: hidden;
  transition: transform ${SLIDE_MS}ms cubic-bezier(0.22, 0.8, 0.3, 1), visibility 0s linear ${SLIDE_MS}ms;
}

/* ---------- Touche ---------- */
.skeu-key {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  color: rgba(255, 157, 51, 0.7);
  border: 1px solid rgba(0, 0, 0, 0.7);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 46%, rgba(0,0,0,0.16) 54%, rgba(0,0,0,0.26) 100%),
    linear-gradient(180deg, #3d404c 0%, #272a33 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -2px 3px rgba(0,0,0,0.45),
    inset 1px 0 0 rgba(255,255,255,0.05),
    inset -1px 0 0 rgba(0,0,0,0.25),
    0 3px 0 #0e0f15,
    0 6px 10px rgba(0,0,0,0.55);
  transition: transform 70ms ease-out, box-shadow 70ms ease-out, color 150ms, opacity 150ms;
  text-decoration: none;
}
.skeu-key--round { border-radius: 9999px; }
.skeu-key--rect  { border-radius: 12px; }
.skeu-key svg {
  filter: drop-shadow(0 -1px 0 rgba(0,0,0,0.85)) drop-shadow(0 1px 0 rgba(255,255,255,0.10));
  transition: filter 150ms;
}
.skeu-key:hover { color: rgba(255, 178, 89, 0.95); }
.skeu-key:focus-visible { outline: 2px solid rgba(255,157,51,0.7); outline-offset: 3px; }
.skeu-key:active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #1b1d24 0%, #262932 100%);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.8),
    inset 0 -1px 0 rgba(255,255,255,0.06),
    0 1px 0 #0e0f15,
    0 2px 5px rgba(0,0,0,0.5);
}
.skeu-key:disabled { opacity: 0.4; cursor: not-allowed; }
.skeu-key:disabled:active { transform: none; }

/* Variante ambre : action principale rétro-éclairée */
.skeu-key--amber,
.skeu-key--amber:hover {
  color: #2a1500;
  background: linear-gradient(180deg, #ffc98a 0%, #ff9d33 52%, #e07a12 100%);
  border-color: rgba(60, 25, 0, 0.85);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.55),
    inset 0 -2px 3px rgba(120,50,0,0.45),
    0 3px 0 #7a3a05,
    0 6px 12px rgba(0,0,0,0.6),
    0 0 14px rgba(255,157,51,0.35);
}
.skeu-key--amber svg { filter: drop-shadow(0 1px 0 rgba(255,255,255,0.35)); }
.skeu-key--amber:active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #e88f25 0%, #d9780f 100%);
  box-shadow:
    inset 0 2px 5px rgba(90,35,0,0.7),
    0 1px 0 #7a3a05,
    0 2px 5px rgba(0,0,0,0.5);
}

/* Variante danger : touche rouge pour les actions destructrices */
.skeu-key--danger,
.skeu-key--danger:hover {
  color: #fff1ee;
  background: linear-gradient(180deg, #ff8a7a 0%, #d93a2b 52%, #a82317 100%);
  border-color: rgba(60, 5, 0, 0.85);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.4),
    inset 0 -2px 3px rgba(90,10,0,0.5),
    0 3px 0 #5e1209,
    0 6px 12px rgba(0,0,0,0.6),
    0 0 14px rgba(255,80,60,0.3);
}
.skeu-key--danger svg { filter: drop-shadow(0 1px 0 rgba(0,0,0,0.4)); }
.skeu-key--danger:active {
  transform: translateY(2px);
  background: linear-gradient(180deg, #c5301f 0%, #a82317 100%);
  box-shadow:
    inset 0 2px 5px rgba(60,5,0,0.7),
    0 1px 0 #5e1209,
    0 2px 5px rgba(0,0,0,0.5);
}

/* ---------- Surfaces creusées / afficheur ---------- */
.skeu-well {
  background: linear-gradient(180deg, #06070b 0%, #0c0e14 100%);
  border: 1px solid rgba(0, 0, 0, 0.75);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.9),
    inset 0 0 0 1px rgba(255,255,255,0.03),
    0 1px 0 rgba(255,255,255,0.08);
}
.skeu-display {
  position: relative;
  overflow: hidden;
  background: linear-gradient(180deg, #06070b 0%, #0c0e14 100%);
  border: 1px solid rgba(0, 0, 0, 0.75);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.9),
    inset 0 0 0 1px rgba(255,255,255,0.03),
    0 1px 0 rgba(255,255,255,0.08);
}
.skeu-display::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(170deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 40%),
    repeating-linear-gradient(0deg, rgba(0,0,0,0.20) 0 1px, rgba(0,0,0,0) 1px 3px);
}
.skeu-display-text {
  color: #ffb259;
  text-shadow: 0 0 6px rgba(255,157,51,0.55);
}

/* Champ de saisie : puits avec texte ambre */
.skeu-input {
  width: 100%;
  color: #ffb259;
  caret-color: #ffb259;
  background: linear-gradient(180deg, #06070b 0%, #0c0e14 100%);
  border: 1px solid rgba(0, 0, 0, 0.8);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.9),
    inset 0 0 0 1px rgba(255,255,255,0.03),
    0 1px 0 rgba(255,255,255,0.08);
  transition: box-shadow 150ms, border-color 150ms;
}
.skeu-input::placeholder { color: rgba(255,157,51,0.35); }
.skeu-input:focus {
  outline: none;
  border-color: rgba(255,157,51,0.55);
  box-shadow:
    inset 0 2px 6px rgba(0,0,0,0.9),
    0 0 10px rgba(255,157,51,0.25);
}

/* ---------- Panneau métal brossé, rainure, vis ---------- */
.skeu-panel {
  position: relative;
  background:
    repeating-linear-gradient(90deg, rgba(255,255,255,0.02) 0 1px, rgba(0,0,0,0) 1px 3px),
    linear-gradient(180deg, #2c2f3a 0%, #1a1c24 100%);
  border: 1px solid rgba(0, 0, 0, 0.85);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.16),
    inset 0 -1px 0 rgba(0,0,0,0.6),
    0 0 0 1px rgba(255,255,255,0.04),
    0 24px 48px rgba(0,0,0,0.85);
}
.skeu-groove {
  height: 2px;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 50%, rgba(255,255,255,0.08) 50%);
}
.skeu-screw {
  display: inline-block;
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border-radius: 9999px;
  background:
    linear-gradient(45deg, rgba(0,0,0,0) 44%, rgba(0,0,0,0.75) 44% 56%, rgba(0,0,0,0) 56%),
    radial-gradient(circle at 35% 30%, #8b8f9e 0%, #4a4d5a 55%, #2a2c35 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.35),
    0 1px 1px rgba(0,0,0,0.8),
    0 0 0 1px rgba(0,0,0,0.6);
}

/* Texte gravé */
.skeu-engraved {
  color: #e8e9ef;
  text-shadow: 0 -1px 0 rgba(0,0,0,0.85), 0 1px 0 rgba(255,255,255,0.08);
}
.skeu-label {
  color: rgba(255,157,51,0.7);
  text-shadow: 0 -1px 0 rgba(0,0,0,0.8);
}

/* ---------- Carte "Ajouter une bande" : emplacement vide creusé ---------- */
.skeu-add {
  background: linear-gradient(180deg, #07080c 0%, #0d0f15 100%);
  border: 2px dashed rgba(255,157,51,0.25);
  box-shadow:
    inset 0 3px 10px rgba(0,0,0,0.9),
    0 1px 0 rgba(255,255,255,0.08);
  color: rgba(255,157,51,0.6);
  transition: border-color 150ms, color 150ms, box-shadow 150ms;
}
.skeu-add:hover {
  border-color: rgba(255,157,51,0.65);
  color: #ffb259;
  box-shadow:
    inset 0 3px 10px rgba(0,0,0,0.9),
    inset 0 0 22px rgba(255,157,51,0.10),
    0 1px 0 rgba(255,255,255,0.08);
}
.skeu-add:focus-visible { outline: 2px solid rgba(255,157,51,0.7); outline-offset: 3px; }
.skeu-add:hover .skeu-key { transform: translateY(-1px); }

@media (prefers-reduced-motion: reduce) {
  .skeu-pane, .skeu-key, .skeu-key svg, .skeu-input, .skeu-add { transition: none; }
}
`;

const PLAYLIST_HOME_STYLE_ID = "skeu-playlist-home-styles";

if (typeof document !== "undefined") {
  const el =
    (document.getElementById(
      PLAYLIST_HOME_STYLE_ID,
    ) as HTMLStyleElement | null) ??
    Object.assign(document.createElement("style"), {
      id: PLAYLIST_HOME_STYLE_ID,
    });
  el.textContent = PLAYLIST_HOME_CSS; // réécrit à chaque HMR
  if (!el.isConnected) document.head.appendChild(el);
}

/* -------------------------------------------------------------------------- */
/*  Composant                                                                  */
/* -------------------------------------------------------------------------- */

interface PlaylistHomeViewProps {
  onOpenPlaylist: (playlistId: string) => void;
  onOpenSettings?: () => void;
}

type PanelKind = "create" | "delete" | "settings";

export const PlaylistHomeView: React.FC<PlaylistHomeViewProps> = ({
  onOpenPlaylist,
  onOpenSettings,
}) => {
  const {
    playlists,
    createPlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    loadPlaylistDetail,
  } = usePlaylistStore();
  const { playTrack } = usePlayerStore();
  const { addWatchedFolderPath } = useLibraryStore();

  // Formulaire de création
  const [playlistName, setPlaylistName] = useState("");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Suppression
  const [deletingPlaylist, setDeletingPlaylist] = useState<Playlist | null>(
    null,
  );

  // Glissade : "list" = grille visible, "panel" = panneau visible.
  // Les deux volets restent montés pendant la glissade, puis le volet caché est démonté
  // pour que la hauteur de la zone suive celle du volet actif.
  const [view, setView] = useState<"list" | "panel">("list");
  const [panel, setPanel] = useState<PanelKind>("create");
  const [listMounted, setListMounted] = useState(true);
  const [panelMounted, setPanelMounted] = useState(false);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const openPanel = useCallback((kind: PanelKind) => {
    clearTimer();
    setPanel(kind);
    setPanelMounted(true);
    setListMounted(true);
    // Deux frames : le volet est d'abord rendu hors-champ, puis glisse vers l'écran.
    requestAnimationFrame(() => requestAnimationFrame(() => setView("panel")));
    timer.current = window.setTimeout(
      () => setListMounted(false),
      SLIDE_MS + 30,
    );
  }, []);

  const closePanel = useCallback(() => {
    clearTimer();
    setListMounted(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setView("list")));
    timer.current = window.setTimeout(() => {
      setPanelMounted(false);
      setDeletingPlaylist(null);
    }, SLIDE_MS + 30);
  }, []);

  // Échap pour revenir à la grille
  useEffect(() => {
    if (view !== "panel") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hapticAudio.playToggleSnap();
        closePanel();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [view, closePanel]);

  const openCreate = () => {
    hapticAudio.playHeavySwitch();
    setPlaylistName("");
    setCoverPath(null);
    setSelectedFolder(null);
    openPanel("create");
  };

  const openDelete = (pl: Playlist) => {
    hapticAudio.playHeavySwitch();
    setDeletingPlaylist(pl);
    openPanel("delete");
  };

  const openSettings = () => {
    hapticAudio.playHeavySwitch();
    if (onOpenSettings) {
      onOpenSettings();
    } else {
      openPanel("settings");
    }
  };

  const handleBack = () => {
    hapticAudio.playToggleSnap();
    closePanel();
  };

  const handlePickCover = async () => {
    hapticAudio.playToggleSnap();
    const picked = await selectImageFile();
    if (picked) setCoverPath(picked);
  };

  const handlePickFolder = async () => {
    hapticAudio.playToggleSnap();
    const folder = await tauriApi.selectFolder();
    if (folder) setSelectedFolder(folder);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    setIsSaving(true);
    hapticAudio.playHeavySwitch();
    try {
      const pl = await createPlaylist(playlistName.trim(), coverPath);

      if (selectedFolder) {
        await addWatchedFolderPath(selectedFolder);
        const { tracks } = useLibraryStore.getState();
        const normalized = selectedFolder.replace(/\\/g, "/");
        const folderTracks = tracks.filter((t) =>
          t.filepath.replace(/\\/g, "/").startsWith(normalized + "/"),
        );
        if (folderTracks.length > 0) {
          await addTracksToPlaylist(
            pl.id,
            folderTracks.map((t) => t.id),
          );
        }
      }

      await loadPlaylistDetail(pl.id);
      closePanel();
      onOpenPlaylist(pl.id);
    } catch (err) {
      console.error("Erreur création playlist:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectPlay = async (e: React.MouseEvent, pl: Playlist) => {
    e.stopPropagation();
    hapticAudio.playHeavySwitch();
    try {
      const tracks = await tauriApi.getPlaylistTracks(pl.id);
      if (tracks.length > 0) {
        playTrack(tracks[0], tracks, 0);
      }
      onOpenPlaylist(pl.id);
    } catch (err) {
      console.error("Erreur lecture playlist:", err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPlaylist) return;
    hapticAudio.playHeavySwitch();
    await deletePlaylist(deletingPlaylist.id);
    closePanel();
  };

  const listState = view === "list" ? "active" : "left";
  const panelState = view === "panel" ? "active" : "right";

  return (
    <div className="skeu-chassis flex-1 h-full w-full overflow-y-auto overflow-x-hidden select-none relative">
      <div className="flex flex-col p-8 max-w-6xl mx-auto w-full min-h-full">
        {/* Zone de glissade : les deux volets sont empilés dans la même cellule */}
        <div className="grid overflow-x-clip">
          {/* ------------------------- Volet 1 : grille ------------------------- */}
          {listMounted && (
            <div
              className="skeu-pane"
              data-state={listState}
              aria-hidden={view !== "list"}
            >
              <div className="mb-8">
                <h1 className="skeu-engraved text-3xl font-black tracking-tight mt-1 pb-4">
                  Playlists
                </h1>
                <div className="skeu-groove" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 pb-16">
                {/* Emplacement vide : « Ajouter une bande » */}
                <button
                  type="button"
                  onClick={openCreate}
                  className="skeu-add group relative flex flex-col items-center justify-center p-6 aspect-[1.32/1] rounded-xl"
                >
                  <div className="skeu-key skeu-key--round w-14 h-14 mb-3 transition-transform">
                    <Plus size={24} strokeWidth={3} />
                  </div>
                  <span className="text-sm font-bold tracking-tight">
                    Ajouter une bande
                  </span>
                  <span className="font-mono text-[11px] opacity-60 mt-1">
                    Dossier local ou vierge
                  </span>
                </button>

                {/* Playlists existantes */}
                {playlists.map((pl) => (
                  <VinylPlaylistCard
                    key={pl.id}
                    playlist={pl}
                    onOpen={onOpenPlaylist}
                    onPlay={(playlist, e) => handleDirectPlay(e, playlist)}
                    onDelete={openDelete}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ------------------------ Volet 2 : panneau ------------------------- */}
          {panelMounted && (
            <div
              className="skeu-pane"
              data-state={panelState}
              aria-hidden={view !== "panel"}
            >
              {/* En-tête : touche retour + afficheur du titre */}
              <div className="mb-8">
                <div className="flex items-center gap-4 pb-4 mt-1">
                  <button
                    type="button"
                    onClick={handleBack}
                    title="Retour aux playlists"
                    aria-label="Retour aux playlists"
                    className="skeu-key skeu-key--round w-10 h-10"
                  >
                    <ArrowLeft size={18} strokeWidth={3} />
                  </button>
                </div>
                <div className="skeu-groove" />
              </div>

              {panel === "settings" ? (
                <div className="w-full max-w-4xl mx-auto pb-16">
                  <SettingsView />
                </div>
              ) : (
                <div className="skeu-panel rounded-2xl p-6 pb-16 max-w-xl mx-auto w-full">
                  {panel === "create" ? (
                    <form onSubmit={handleCreate} className="flex flex-col gap-5">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="pl-name"
                          className="skeu-label font-mono text-[11px] font-bold uppercase tracking-[0.18em]"
                        >
                          Nom de la playlist
                        </label>
                        <input
                          id="pl-name"
                          type="text"
                          value={playlistName}
                          onChange={(e) => setPlaylistName(e.target.value)}
                          placeholder="Ex: Master Mix, Lo-Fi Chill, Favoris..."
                          className="skeu-input rounded-lg px-4 py-2.5 text-sm font-medium"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="skeu-label font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
                          Dossier musical source (facultatif)
                        </span>
                        <button
                          type="button"
                          onClick={handlePickFolder}
                          className="skeu-key skeu-key--rect h-11 w-full justify-between px-4 text-xs font-bold"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <FolderOpen size={16} className="flex-shrink-0" />
                            <span className="truncate">
                              {selectedFolder ||
                                "Sélectionner un dossier MP3 / FLAC"}
                            </span>
                          </span>
                          {selectedFolder && (
                            <span className="font-mono text-[10px] uppercase text-[#ffb259]">
                              Choisi
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="skeu-label font-mono text-[11px] font-bold uppercase tracking-[0.18em]">
                          Image d'étiquette (facultatif)
                        </span>
                        <button
                          type="button"
                          onClick={handlePickCover}
                          className="skeu-key skeu-key--rect h-11 w-full justify-between px-4 text-xs font-bold"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <ListMusic size={16} className="flex-shrink-0" />
                            <span className="truncate">
                              {coverPath
                                ? "Image sélectionnée"
                                : "Choisir une image"}
                            </span>
                          </span>
                          {coverPath && (
                            <span className="font-mono text-[10px] uppercase text-[#ffb259]">
                              Choisie
                            </span>
                          )}
                        </button>
                      </div>

                      <div className="skeu-groove" />

                      <div className="flex justify-end gap-3 pb-1">
                        <button
                          type="button"
                          onClick={handleBack}
                          className="skeu-key skeu-key--rect h-10 px-5 text-xs font-bold"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={!playlistName.trim() || isSaving}
                          className="skeu-key skeu-key--rect skeu-key--amber h-10 px-5 text-xs font-black"
                        >
                          {isSaving ? "Création en cours..." : "Créer la bande"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-5">
                      <div className="skeu-display rounded-lg px-4 py-3">
                        <p className="skeu-display-text font-mono text-xs leading-relaxed">
                          Voulez-vous vraiment supprimer la playlist «{" "}
                          {deletingPlaylist?.name} » ? Vos fichiers musicaux
                          d'origine ne seront pas affectés.
                        </p>
                      </div>

                      <div className="skeu-groove" />

                      <div className="flex justify-end gap-3 pb-1">
                        <button
                          type="button"
                          onClick={handleBack}
                          className="skeu-key skeu-key--rect h-10 px-5 text-xs font-bold"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteConfirm}
                          className="skeu-key skeu-key--rect skeu-key--danger h-10 px-5 text-xs font-black"
                        >
                          Confirmer la suppression
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Vis de fixation du panneau */}
                  <span
                    aria-hidden
                    className="skeu-screw absolute top-2 left-2"
                  />
                  <span
                    aria-hidden
                    className="skeu-screw absolute top-2 right-2"
                  />
                  <span
                    aria-hidden
                    className="skeu-screw absolute bottom-2 left-2"
                  />
                  <span
                    aria-hidden
                    className="skeu-screw absolute bottom-2 right-2"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barre d'actions inférieure : Paramètres (gauche) & GitHub Open Source (droite) */}
        <footer className="mt-auto pt-6 pb-2">
          <div className="skeu-groove mb-6" />
          <div className="flex items-center justify-between gap-4">
            {/* Bouton Paramètres */}
            <button
              type="button"
              onClick={openSettings}
              title="Ouvrir les paramètres et la configuration système"
              aria-label="Paramètres"
              className="skeu-key skeu-key--rect h-10 px-4 gap-2.5 text-xs font-mono font-bold tracking-wider group"
            >
              <Settings
                size={16}
                strokeWidth={2.2}
                className="transition-transform duration-200 group-hover:rotate-45"
              />
              <span>PARAMÈTRES</span>
            </button>

            {/* Bouton GitHub Open Source */}
            <a
              href="https://github.com/Bel-bg/Musik"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => hapticAudio.playToggleSnap()}
              title="Projet open source - Découvrir le code source ou contribuer sur GitHub"
              aria-label="Code source GitHub"
              className="skeu-key skeu-key--rect h-10 px-4 gap-2.5 text-xs font-mono font-bold tracking-wider group"
            >
              <GithubIcon
                size={16}
                className="transition-transform duration-200 group-hover:scale-110 text-[#ffb259]"
              />
              <span className="flex items-center gap-1.5">
                <span>GITHUB</span>
              </span>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};
