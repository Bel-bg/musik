import { useEffect, useRef, useState } from "react";
import { audioAnalysis } from "@/lib/audioAnalysis";

/** Ce que le visualiseur peut écouter : une balise audio, ou un nœud d'un graphe Web Audio existant. */
export type AudioSource = HTMLMediaElement | AudioNode;

/*
 * RÈGLE D'OR : le visualiseur ne doit JAMAIS toucher au chemin audio du lecteur.
 * On ÉCOUTE (captureStream / tap sur un nœud), on ne REDIRIGE pas.
 * Pire cas = barres plates, jamais un son coupé.
 */

interface ElementTap {
  ctx: AudioContext;
  analyser: AnalyserNode;
  node: MediaStreamAudioSourceNode | null;
}

const elementTaps = new WeakMap<HTMLMediaElement, ElementTap>();
const nodeAnalysers = new WeakMap<AudioNode, AnalyserNode>();

type CapturableMedia = HTMLMediaElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

function configure(analyser: AnalyserNode) {
  analyser.fftSize = 2048; // 1024 bins : assez de résolution dans les basses
  analyser.smoothingTimeConstant = 0.55; // le gros du lissage est fait côté canvas (attack/release)
  analyser.minDecibels = -88;
  analyser.maxDecibels = -18;
  return analyser;
}

/** Puits muet : garantit que l'analyseur est traité par tous les moteurs, sans rien faire entendre. */
function addSilentSink(ctx: BaseAudioContext, analyser: AnalyserNode) {
  const mute = ctx.createGain();
  mute.gain.value = 0;
  analyser.connect(mute);
  mute.connect(ctx.destination);
}

function tapElement(el: HTMLMediaElement): AnalyserNode | null {
  const media = el as CapturableMedia;
  const capture = media.captureStream ?? media.mozCaptureStream;
  if (!capture) {
    console.warn(
      "[useAudioAnalyser] captureStream() indisponible dans cette webview : " +
        "le spectre ne peut pas écouter la balise audio (le son, lui, n'est pas touché).",
    );
    return null;
  }

  let tap = elementTaps.get(el);
  if (!tap) {
    const AC: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AC();
    const analyser = configure(ctx.createAnalyser());
    addSilentSink(ctx, analyser);
    tap = { ctx, analyser, node: null };
    elementTaps.set(el, tap);
  }

  // (Re)branche le flux capturé s'il n'existe pas ou si sa piste est terminée (changement de morceau)
  const alive =
    !!tap.node &&
    tap.node.mediaStream.getAudioTracks().some((t) => t.readyState === "live");
  if (!alive) {
    tap.node?.disconnect();
    tap.node = null;
    const stream = capture.call(el);
    if (stream.getAudioTracks().length > 0) {
      tap.node = tap.ctx.createMediaStreamSource(stream);
      tap.node.connect(tap.analyser);
    }
  }
  return tap.analyser;
}

function tapNode(node: AudioNode): AnalyserNode {
  const cached = nodeAnalysers.get(node);
  if (cached) return cached;
  // Simple écoute en dérivation : le chemin audio existant n'est pas modifié.
  const analyser = configure(node.context.createAnalyser());
  node.connect(analyser);
  addSilentSink(node.context, analyser);
  nodeAnalysers.set(node, analyser);
  return analyser;
}

function attach(source: AudioSource): AnalyserNode | null {
  return source instanceof HTMLMediaElement
    ? tapElement(source)
    : tapNode(source);
}

/**
 * Renvoie un AnalyserNode branché sur la musique en cours (ou null tant qu'il
 * n'y a pas de source). La source est résolue paresseusement, au moment où la
 * lecture démarre : l'élément audio n'existe parfois qu'au premier play.
 *
 * @param getSource  fonction qui renvoie la source (voir lib/audioSource.ts)
 * @param active     true quand la musique joue
 * @param retryKey   change (ex. id de piste) pour re-brancher le flux au changement de morceau
 */
export function useAudioAnalyser(
  getSource: () => AudioSource | null,
  active: boolean,
  retryKey?: unknown,
): AnalyserNode | null {
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const getSourceRef = useRef(getSource);
  getSourceRef.current = getSource;

  useEffect(() => {
    if (!active) return;

    const source = getSourceRef.current();
    if (!source) {
      console.warn(
        "[useAudioAnalyser] Aucune source audio trouvée — adapte getPlayerAudioSource() dans lib/audioSource.ts",
      );
      return;
    }

    const run = () => {
      try {
        const direct = audioAnalysis.getAnalyser();
        if (direct) {
          setAnalyser(direct);
          audioAnalysis.resume();
          return;
        }

        const node = attach(source);
        if (node) {
          setAnalyser((prev) => (prev === node ? prev : node));
          const ctx = node.context as AudioContext;
          if (ctx.state === "suspended") void ctx.resume();
        }
      } catch (err) {
        console.error("[useAudioAnalyser] Branchement impossible", err);
      }
    };

    run();
    // Le flux capturé n'a parfois pas encore de piste audio au tout début de la lecture
    const timers = [300, 1200].map((ms) => window.setTimeout(run, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [active, retryKey]);

  return analyser;
}
