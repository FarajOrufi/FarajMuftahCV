import { subscribeMotion } from "./motion-clock";
import { motionSound } from "./tunnel-audio-motion";
import { audioEnvelope, audioOutputDelay } from "./audio-envelope";
import { sceneAudioScore, ringCueTracker } from "./scene-audio-score";
import { createSceneAudioLayers } from "./scene-audio-layers";

export const MOTION_AUDIO_ASSET = "/audio/dark-oscillator-motion-v1.wav";

export type AudioTelemetry = {
  enabled: boolean; context: string; source: string; loaded: boolean;
  ticks: number; voices: number; speed: number; peak: number; maxPeak: number; rms: number;
  clock: number; revision: string; travel: number; direction: number; gain: number;
  rate: number; crossing: number; phase: string; ring: number; brightness: number;
  startClock: number; frameMs: number; preparationMs: number;
  meterLive: boolean; loopSeconds: number;
  baseLatencyMs: number; outputLatencyMs: number | null; outputDelayMs: number | null;
  audioTravel: number; audioCrossing: number; leadMs: number; envelopeGain: number;
  stalledFrames: number;
  scene: ReturnType<typeof sceneAudioScore>; layerVoices: number; cueCount: number;
  qa?: {
    frames: number; medianFrameMs: number; p95FrameMs: number; longFrames: number;
    medianCommandMs: number; p95CommandMs: number; maxVoices: number;
    movingFrames: number; medianMovingFrameMs: number; p95MovingFrameMs: number; longMovingFrames: number;
    crossings: { ring: number; direction: number; travel: number; clock: number }[];
    cues: { ring: number; direction: number; travel: number; audioTravel: number; clock: number; scene: string; leadMs: number }[];
  };
};

const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
};

/** Spatial scene score: a quiet licensed texture, depth/signal layers and
 * direction-aware finite ring crossings. All share the camera's motion gate.
 * One same-origin asset; no dependencies, ambient playback or event backlog.
 */
export function createTunnelAudio(report: (state: AudioTelemetry) => void, interrupted: () => void,
  reportMotion?: (state: { travel: number; velocity: number; gain: number; rate: number; phase: string; clock: number;
    audioTravel: number; audioCrossing: number; leadMs: number; envelopeGain: number; visualTimeMs: number }) => void) {
  // Constructed inside a genuine sound-button gesture, never during SSR or mount.
  const context = new AudioContext({ latencyHint: "interactive" });
  const motionGain = context.createGain(), tone = context.createBiquadFilter(), analyser = context.createAnalyser();
  const textureGain = context.createGain(); textureGain.gain.value = 0;
  const textureEnvelope = audioEnvelope(textureGain.gain, 0, context.currentTime);
  const layers = createSceneAudioLayers(context, motionGain);
  const cueTracker = ringCueTracker();
  let score = sceneAudioScore(0, 0, 0), cueCount = 0;
  const meter = new Float32Array(1024);
  const debug = process.env.NODE_ENV !== "production";
  const frameTimes: number[] = [], commandTimes: number[] = [], movingFrameTimes: number[] = [];
  const crossings: NonNullable<AudioTelemetry["qa"]>["crossings"] = [];
  const cues: NonNullable<AudioTelemetry["qa"]>["cues"] = [];
  let lastCrossing = -1, lastCrossingDirection = 0, previousTravel: number | undefined, maxVoices = 0;
  motionGain.gain.value = 0;
  tone.type = "lowpass"; tone.frequency.value = 620; tone.Q.value = .55;
  analyser.fftSize = 1024;
  tone.connect(textureGain); textureGain.connect(motionGain); motionGain.connect(analyser); analyser.connect(context.destination);
  const gainEnvelope = audioEnvelope(motionGain.gain, 0, context.currentTime);
  const toneEnvelope = audioEnvelope(tone.frequency, 620, context.currentTime);
  let rateEnvelope: ReturnType<typeof audioEnvelope> | undefined;

  let buffer: AudioBuffer | undefined, active: AudioBufferSourceNode | undefined;
  let loading: Promise<AudioBuffer> | undefined;
  const download = new AbortController();
  const voices = new Set<AudioBufferSourceNode>();
  let enabled = false, disposed = false, ticks = 0, maxPeak = 0, nextReport = 0, quietSince: number | undefined;
  let travel = 0, level = 0, rate = 1, crossing = 0, direction = 0, phase = "still", ring = 0, brightness = 620;
  let startClock = 0, frameMs = 0, previousFrame = 0, preparationMs = 0, width = 0, height = 0;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  let audioTravel = 0, audioCrossing = 0, leadMs = 0;
  let stalledFrames = 0;
  let outputDelay: number | undefined;
  const measure = () => {
    analyser.getFloatTimeDomainData(meter);
    let peak = 0, square = 0;
    for (const value of meter) { peak = Math.max(peak, Math.abs(value)); square += value * value; }
    maxPeak = Math.max(maxPeak, peak);
    return { peak, rms: Math.sqrt(square / meter.length) };
  };
  const send = (speed: number, peak: number, rms = 0) => {
    const stamp = context.getOutputTimestamp?.();
    // Device-output estimate in performance-clock ms, NOT a microphone sync test.
    const outputDelayMs = stamp?.performanceTime && stamp.contextTime
      ? Math.max(0, stamp.performanceTime + (context.currentTime - stamp.contextTime) * 1000 - performance.now()) : null;
    report({
      enabled, context: context.state, source: "mixkit-dark-synth-oscillator-646", loaded: !!buffer,
      // Suspended analysers retain an old window; it is not current output.
      ticks, voices: voices.size + layers.voices, speed, peak: enabled && context.state === "running" ? peak : 0,
      maxPeak, rms: enabled && context.state === "running" ? rms : 0, clock: context.currentTime,
      revision: "spatial-scene-score-v3", travel, direction, gain: level, rate, crossing, phase, ring, brightness,
      scene: score, layerVoices: layers.voices, cueCount,
      audioTravel, audioCrossing, leadMs, envelopeGain: gainEnvelope.valueAt(context.currentTime), stalledFrames,
      startClock, frameMs, preparationMs, baseLatencyMs: (context.baseLatency ?? 0) * 1000,
      meterLive: enabled && context.state === "running",
      loopSeconds: buffer?.duration ?? 0,
      outputLatencyMs: typeof context.outputLatency === "number" ? context.outputLatency * 1000 : null,
      outputDelayMs,
      ...(debug ? { qa: {
        frames: frameTimes.length, medianFrameMs: percentile(frameTimes, .5), p95FrameMs: percentile(frameTimes, .95),
        longFrames: frameTimes.filter(ms => ms > 50).length,
        medianCommandMs: percentile(commandTimes, .5), p95CommandMs: percentile(commandTimes, .95),
        movingFrames: movingFrameTimes.length, medianMovingFrameMs: percentile(movingFrameTimes, .5),
        p95MovingFrameMs: percentile(movingFrameTimes, .95), longMovingFrames: movingFrameTimes.filter(ms => ms > 50).length,
        maxVoices, crossings: [...crossings], cues: [...cues],
      } } : {}),
    });
  };
  const releaseVoices = (immediate = false) => {
    active = undefined; rateEnvelope = undefined;
    voices.forEach(source => {
      try { source.stop(immediate ? context.currentTime : context.currentTime + .05); } catch {}
      if (immediate) { source.disconnect(); voices.delete(source); }
    });
    // The master envelope handles ordinary release; immediate resets must also
    // disconnect tonal sources when the audio clock is suspended.
    if (immediate) layers.stop();
  };
  const startVoice = () => {
    if (!buffer || disposed || !enabled) return;
    // Old texture voices may still be in their 50ms stop window.
    voices.forEach(source => { source.stop(); source.disconnect(); voices.delete(source); });
    const source = context.createBufferSource();
    source.buffer = buffer; source.loop = true;
    source.playbackRate.setValueAtTime(rate, context.currentTime);
    rateEnvelope = audioEnvelope(source.playbackRate, rate, context.currentTime);
    source.connect(tone); voices.add(source); active = source;
    source.addEventListener("ended", () => {
      voices.delete(source);
      if (active === source) active = undefined;
      source.disconnect();
    }, { once: true });
    source.start(context.currentTime); startClock = context.currentTime; ticks++;
    maxVoices = Math.max(maxVoices, voices.size);
  };
  const unsubscribe = subscribeMotion(frame => {
    if (!enabled || context.state !== "running" || document.hidden) return;
    const stamp = performance.now();
    frameMs = previousFrame ? stamp - previousFrame : 0; previousFrame = stamp;
    const sound = motionSound(frame);
    travel = frame.travel; rate = sound.rate; crossing = sound.crossing;
    direction = sound.direction; phase = sound.phase; ring = sound.ring; brightness = sound.brightness;
    const now = context.currentTime, moving = sound.gain > 0;
    // Compensate only spatial emphasis. Speed/start/stop still use actual motion.
    // The current easing can be continued exactly without guessing future input.
    // Six ms also offsets the small filter/gain envelope, not a new inertia layer.
    const measuredDelay = Math.min(.074, audioOutputDelay(context, stamp));
    outputDelay ??= measuredDelay;
    // Timestamp readout jitters by audio blocks; don't let that shake the tone.
    outputDelay += (measuredDelay - outputDelay) * (1 - Math.exp(-frame.dt / .12));
    leadMs = moving && frame.project ? (outputDelay + .006) * 1000 : 0;
    const projected = leadMs ? frame.project!(leadMs / 1000) : frame;
    const spatial = motionSound({ ...frame, ...projected });
    audioTravel = projected.travel; audioCrossing = spatial.crossing;
    level = moving ? spatial.gain : 0; brightness = spatial.brightness;
    score = sceneAudioScore(audioTravel, frame.velocity, projected.dark.blackout);
    brightness = score.cutoff;
    if (width !== frame.width || height !== frame.height) {
      width = frame.width; height = frame.height;
      releaseVoices(true); quietSince = undefined; level = 0; previousTravel = travel;
      cueTracker.reset(travel);
      gainEnvelope.reset(0, now); leadMs = 0; audioTravel = travel; outputDelay = undefined; send(0, 0); return;
    }
    if (frameMs > 120) {
      // A visible-but-occluded browser can throttle RAF without hiding the page.
      // Its capped visual dt is not an audible velocity; discard stale feedback.
      stalledFrames++; releaseVoices(true); gainEnvelope.reset(0, now); outputDelay = undefined;
      quietSince = undefined; previousTravel = travel; cueTracker.reset(travel); level = 0; leadMs = 0; audioTravel = travel; phase = "stalled";
      if (debug) reportMotion?.({ travel, velocity: frame.velocity, gain: 0, rate, phase, clock: now,
        audioTravel, audioCrossing, leadMs, envelopeGain: 0, visualTimeMs: stamp });
      send(0, 0); return;
    }
    if (debug && frameMs > 0) {
      frameTimes.push(frameMs);
      if (frameTimes.length > 600) frameTimes.shift();
      if (moving) {
        movingFrameTimes.push(frameMs);
        if (movingFrameTimes.length > 600) movingFrameTimes.shift();
      }
      if (previousTravel !== undefined && moving) {
        // Actual visual-plane timestamps, compared with the projected cue log.
        // These diagnostics do not drive playback or queue skipped crossings.
        const first = Math.max(1, Math.ceil(Math.min(previousTravel, travel)));
        const last = Math.min(11, Math.floor(Math.max(previousTravel, travel)));
        for (let plane = first; plane <= last; plane++) {
          if (previousTravel === travel || previousTravel === plane) continue;
          if (plane === lastCrossing && (direction === lastCrossingDirection || Math.abs(travel - plane) < .08)) continue;
          crossings.push({ ring: plane, direction, travel, clock: now });
          if (crossings.length > 32) crossings.shift();
          lastCrossing = plane; lastCrossingDirection = direction;
        }
      }
    }
    previousTravel = travel;
    if (moving) {
      quietSince = undefined;
      if (!active) startVoice();
      rateEnvelope?.target(rate, now, .006);
      layers.update(score, direction);
      const event = cueTracker.update(audioTravel, true);
      if (event) {
        layers.cross(score, event.direction); cueCount++;
        if (debug) {
          cues.push({ ...event, travel, audioTravel, clock: now, scene: score.scene, leadMs });
          if (cues.length > 32) cues.shift();
        }
      }
      maxVoices = Math.max(maxVoices, voices.size + layers.voices);
    } else {
      cueTracker.update(audioTravel, false);
      quietSince ??= now;
      if (active && (frame.reduced || now - quietSince > .09)) { releaseVoices(); layers.stop(); }
    }
    // Camera smoothing already supplies inertia; don't add a long audio envelope.
    gainEnvelope.target(level, now, moving ? .004 : .008);
    if (moving) gainEnvelope.expire(now + .12, .008);
    toneEnvelope.target(brightness, now, .006);
    textureEnvelope.target(score.texture, now, .008);
    if (!moving && quietSince !== undefined && now - quietSince >= .04 && gainEnvelope.valueAt(now) !== 0) gainEnvelope.reset(0, now);
    if (debug && moving) {
      commandTimes.push(performance.now() - stamp);
      if (commandTimes.length > 600) commandTimes.shift();
    }
    // Tiny dev-only frame snapshot; compare with the existing portal/camera dataset.
    // Full percentiles/energy reports stay throttled and are not a separate timeline.
    if (debug) reportMotion?.({ travel, velocity: frame.velocity, gain: level, rate, phase, clock: now,
      audioTravel, audioCrossing, leadMs, envelopeGain: gainEnvelope.valueAt(now), visualTimeMs: stamp });
    const energy = measure();
    if (frame.time >= nextReport || frame.reduced) {
      nextReport = frame.time + .08;
      send(sound.speed, energy.peak, energy.rms);
    }
  });
  const visibility = () => {
    gainEnvelope.reset(0, context.currentTime); releaseVoices(true);
    quietSince = undefined; previousTravel = undefined; previousFrame = 0; level = 0; width = 0; outputDelay = undefined;
    cueTracker.reset();
    if (document.hidden) context.suspend().then(() => { if (!disposed) send(0, 0); }).catch(() => {});
    else if (enabled && !disposed) context.resume().catch(() => { enabled = false; interrupted(); });
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    async enable() {
      clearTimeout(suspendTimer);
      if (disposed) return;
      // Resume synchronously in the user's gesture, before the first await.
      const resumed = context.resume(), begin = performance.now();
      const prepared = buffer ? Promise.resolve(buffer) : loading ??= (async () => {
        const response = await fetch(MOTION_AUDIO_ASSET, { signal: download.signal });
        if (!response.ok) throw new Error(`Motion sound unavailable (${response.status})`);
        const encoded = await response.arrayBuffer();
        if (disposed) throw new Error("Motion sound disposed during loading");
        const decoded = await context.decodeAudioData(encoded);
        if (decoded.duration < .5 || decoded.duration > 4) throw new Error("Unexpected motion loop duration");
        return decoded;
      })();
      const [, decoded] = await Promise.all([resumed, prepared]);
      if (disposed) return;
      if (!buffer) { buffer = decoded; preparationMs = performance.now() - begin; }
      enabled = true; quietSince = undefined; previousFrame = 0; previousTravel = undefined; width = 0; outputDelay = undefined;
      cueTracker.reset();
      if (document.hidden) visibility();
      send(0, 0);
    },
    disable() {
      enabled = false; quietSince = undefined; level = 0; phase = "still"; leadMs = 0; audioTravel = travel;
      gainEnvelope.target(0, context.currentTime, .006); releaseVoices();
      suspendTimer = setTimeout(() => {
        if (!enabled && !disposed) {
          // A browser can suspend its audio clock before a scheduled stop fires.
          // Explicitly disconnect/release retained sources, even on that path.
          releaseVoices(true);
          gainEnvelope.reset(0, context.currentTime);
          context.suspend().then(() => {
            if (!disposed && !enabled) { const energy = measure(); send(0, energy.peak, energy.rms); }
          }).catch(() => {});
        }
      }, 80);
      const energy = measure(); send(0, energy.peak, energy.rms);
    },
    dispose() {
      if (disposed) return;
      disposed = true; enabled = false; download.abort(); clearTimeout(suspendTimer); unsubscribe();
      document.removeEventListener("visibilitychange", visibility); releaseVoices(true);
      buffer = undefined; loading = undefined; layers.dispose(); textureGain.disconnect(); tone.disconnect(); motionGain.disconnect(); analyser.disconnect();
      context.close().catch(() => {});
    },
  };
}
