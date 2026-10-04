import { audioEnvelope } from "./audio-envelope";
import type { sceneAudioScore } from "./scene-audio-score";

type Score = ReturnType<typeof sceneAudioScore>;

/** Two retained tonal layers, one crossing voice and one bounded 12ms fade. They feed
 * the SAME motion/stop envelope as the texture; none can outlive motion or mute. */
export function createSceneAudioLayers(context: AudioContext, destination: AudioNode) {
  const depthGain = context.createGain(), signalGain = context.createGain();
  depthGain.gain.value = signalGain.gain.value = 0;
  depthGain.connect(destination); signalGain.connect(destination);
  const depthEnvelope = audioEnvelope(depthGain.gain, 0, context.currentTime);
  const signalEnvelope = audioEnvelope(signalGain.gain, 0, context.currentTime);
  let depth: OscillatorNode | undefined, signal: OscillatorNode | undefined;
  let rootEnvelope: ReturnType<typeof audioEnvelope> | undefined;
  let frequencyEnvelope: ReturnType<typeof audioEnvelope> | undefined;
  type Cue = { source: OscillatorNode; gain: GainNode; direction: number; end: number;
    envelope: ReturnType<typeof audioEnvelope> };
  let cue: Cue | undefined;
  const fading = new Set<Cue>();

  const stopCue = (immediate = false) => {
    for (const old of fading) { old.source.stop(); old.source.disconnect(); old.gain.disconnect(); }
    fading.clear();
    if (!cue) return;
    if (immediate || context.currentTime >= cue.end) {
      cue.source.stop(); cue.source.disconnect(); cue.gain.disconnect();
    } else {
      cue.envelope.target(0, context.currentTime, .002);
      cue.source.stop(context.currentTime + .012); fading.add(cue);
    }
    cue = undefined;
  };
  const stop = () => {
    stopCue(true);
    depth?.stop(); depth?.disconnect(); signal?.stop(); signal?.disconnect();
    depth = signal = undefined; rootEnvelope = frequencyEnvelope = undefined;
    depthEnvelope.reset(0, context.currentTime); signalEnvelope.reset(0, context.currentTime);
  };
  return {
    get voices() { return (depth ? 2 : 0) + (cue ? 1 : 0) + fading.size; },
    update(score: Score, direction: number) {
      const now = context.currentTime;
      if (cue && (cue.direction !== direction || now >= cue.end)) stopCue();
      if (!depth) {
        depth = context.createOscillator(); signal = context.createOscillator();
        depth.type = "sine"; signal.type = "triangle";
        depth.frequency.value = score.root; signal.frequency.value = score.signalHz;
        rootEnvelope = audioEnvelope(depth.frequency, score.root, now);
        frequencyEnvelope = audioEnvelope(signal.frequency, score.signalHz, now);
        depth.connect(depthGain); signal.connect(signalGain);
        depth.start(now); signal.start(now);
      }
      rootEnvelope?.target(score.root, now, .012);
      frequencyEnvelope?.target(score.signalHz, now, .012);
      depthEnvelope.target(score.depth, now, .008);
      signalEnvelope.target(score.signal, now, .008);
    },
    cross(score: Score, direction: number) {
      stopCue();
      const now = context.currentTime, source = context.createOscillator(), gain = context.createGain();
      // A short tonal pressure seal, not a mouse click, blast, or noise whoosh.
      source.type = "sine";
      source.frequency.setValueAtTime(score.cueHz * (direction > 0 ? 1.12 : .88), now);
      source.frequency.exponentialRampToValueAtTime(score.cueHz, now + .09);
      gain.gain.value = 0;
      const envelope = audioEnvelope(gain.gain, 0, now);
      envelope.target(score.cueGain, now, .003);
      envelope.expire(now + .016, .018);
      source.connect(gain); gain.connect(destination);
      const current = { source, gain, direction, end: now + .14, envelope }; cue = current;
      source.addEventListener("ended", () => {
        source.disconnect(); gain.disconnect(); fading.delete(current); if (cue === current) cue = undefined;
      }, { once: true });
      source.start(now); source.stop(now + .14);
    },
    stop,
    dispose() { stop(); depthGain.disconnect(); signalGain.disconnect(); },
  };
}
