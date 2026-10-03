import type { AudioSource } from "@/hooks/useAudioAnalyser";

/**
 * ⚠️ À ADAPTER À TON MOTEUR AUDIO — c'est le SEUL endroit à toucher.
 *
 * Renvoie ce que le visualiseur doit écouter :
 *  - un HTMLMediaElement (<audio> ou `new Audio()`) si la lecture passe par une balise audio ;
 *  - ou un AudioNode (GainNode final, etc.) si tu as déjà un graphe Web Audio
 *    (dans ce cas on se contente d'écouter, sans toucher au chemin audio) ;
 *  - null si rien n'est disponible : les barres restent alors au repos (rien n'est simulé).
 *
 * Si la lecture est faite côté Rust (rodio / symphonia…), le Web Audio ne peut pas
 * l'écouter : il faudra calculer la FFT en Rust et l'envoyer par events Tauri.
 *
 * Version par défaut : cherche une balise <audio> dans le DOM.
 */
export function getPlayerAudioSource(): AudioSource | null {
  return document.querySelector("audio");
}
