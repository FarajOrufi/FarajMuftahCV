import { audioEnvelope } from "./audio-envelope";
import type { sceneAudioScore } from "./scene-audio-score";
type Score = ReturnType<typeof sceneAudioScore>;
export const SCENE_AUDIO_ASSETS = ["/audio/scene-approach-v1.wav", "/audio/scene-dark-v1.wav", "/audio/scene-cross-v2.wav"];

/** Spatial gains follow the camera, never the position of a background track. */
export function createSceneAudioLayers(context: AudioContext, destination: AudioNode) {
  const approachGain = context.createGain(), darkGain = context.createGain();
  approachGain.gain.value = darkGain.gain.value = 0;
  approachGain.connect(destination); darkGain.connect(destination);
  const approachEnvelope = audioEnvelope(approachGain.gain, 0, context.currentTime);
  const darkEnvelope = audioEnvelope(darkGain.gain, 0, context.currentTime);
  let buffers: AudioBuffer[] = [];
  let approach: AudioBufferSourceNode | undefined, dark: AudioBufferSourceNode | undefined;
  type Cue = { source: AudioBufferSourceNode; gain: GainNode; direction: number; end: number;
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
    approach?.stop(); approach?.disconnect(); dark?.stop(); dark?.disconnect();
    approach = dark = undefined;
    approachEnvelope.reset(0, context.currentTime); darkEnvelope.reset(0, context.currentTime);
  };
  const loop = (buffer: AudioBuffer, output: AudioNode) => {
    const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
    source.connect(output); source.start(context.currentTime); return source;
  };
  return {
    prepare(decoded: AudioBuffer[]) { buffers = decoded; },
    get voices() { return (approach ? 2 : 0) + (cue ? 1 : 0) + fading.size; },
    update(score: Score, direction: number, darkness = 0) {
      if (buffers.length !== 3) return;
      const now = context.currentTime;
      if (cue && (cue.direction !== direction || now >= cue.end)) stopCue();
      if (!approach) {
        approach = loop(buffers[0], approachGain); dark = loop(buffers[1], darkGain);
        // 18% longer pressure cycle, slightly deeper; spatial stop remains immediate.
        approach.playbackRate.value = .85;
      }
      approachEnvelope.target(1.0 * score.approach * (1 - darkness), now, .006);
      darkEnvelope.target(.82 * darkness, now, .008);
    },
    cross(score: Score, direction: number) {
      if (buffers.length !== 3) return;
      stopCue();
      const now = context.currentTime, source = context.createBufferSource(), gain = context.createGain();
      source.buffer = buffers[2]; source.playbackRate.value = direction > 0 ? 1 : 1.07;
      gain.gain.value = 0;
      const envelope = audioEnvelope(gain.gain, 0, now);
      envelope.target(.55 * (score.cueGain / .145), now, .003);
      envelope.expire(now + .025, .026);
      source.connect(gain); gain.connect(destination);
      const duration = Math.min(.12, buffers[2].duration / source.playbackRate.value);
      const current = { source, gain, direction, end: now + duration, envelope }; cue = current;
      source.addEventListener("ended", () => {
        source.disconnect(); gain.disconnect(); fading.delete(current); if (cue === current) cue = undefined;
      }, { once: true });
      source.start(now); source.stop(now + duration);
    },
    stop,
    dispose() { stop(); buffers = []; approachGain.disconnect(); darkGain.disconnect(); },
  };
}
