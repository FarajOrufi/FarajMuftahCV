import { subscribeMotion } from "./motion-clock";

export type AudioTelemetry = {
  enabled: boolean;
  context: string;
  source: string;
  loaded: boolean;
  ticks: number;
  voices: number;
  speed: number;
  peak: number;
  maxPeak: number;
  clock: number;
};

const SAMPLE_URL = "/audio/nexawave-whoosh.mp3";

/** Shape a real cinematic whoosh with the same motion clock that drives the tunnel. */
export function createTunnelAudio(report: (state: AudioTelemetry) => void, interrupted: () => void) {
  const context = new AudioContext({ latencyHint: "interactive" });
  const motionGain = context.createGain();
  const lowShelf = context.createBiquadFilter();
  const presence = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const analyser = context.createAnalyser();
  const meter = new Float32Array(2048);
  const voices = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();

  motionGain.gain.value = 0;
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = 160;
  lowShelf.gain.value = -5;
  presence.type = "peaking";
  presence.frequency.value = 470;
  presence.Q.value = .8;
  presence.gain.value = 5;
  compressor.threshold.value = -14;
  compressor.knee.value = 10;
  compressor.ratio.value = 5;
  compressor.attack.value = .008;
  compressor.release.value = .2;
  analyser.fftSize = 2048;
  motionGain.connect(lowShelf);
  lowShelf.connect(presence);
  presence.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(context.destination);

  let sample: AudioBuffer | undefined;
  let loading: Promise<AudioBuffer> | undefined;
  let enabled = false, disposed = false, direction = 0;
  let ticks = 0, maxPeak = 0, nextReport = 0, nextPlayAt = 0;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;

  const target = (param: AudioParam, value: number, seconds: number) => {
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  };
  const send = (speed: number, peak: number) => report({
    enabled,
    context: context.state,
    source: "nexawave",
    loaded: !!sample,
    ticks,
    voices: voices.size,
    speed,
    peak,
    maxPeak,
    clock: context.currentTime,
  });
  const loadSample = () => {
    loading ??= fetch(SAMPLE_URL)
      .then(response => {
        if (!response.ok) throw new Error(`Unable to load tunnel sound (${response.status})`);
        return response.arrayBuffer();
      })
      .then(bytes => context.decodeAudioData(bytes))
      .then(decoded => {
        if (decoded.duration < 7.4) throw new Error("Tunnel sound is incomplete");
        sample = decoded;
        return decoded;
      })
      .catch(error => { loading = undefined; throw error; });
    return loading;
  };
  const fadeVoices = () => {
    const now = context.currentTime;
    voices.forEach(({ source, gain }) => {
      target(gain.gain, 0, .045);
      try { source.stop(now + .2); } catch {}
    });
  };
  const playWhoosh = (newDirection: number, speed: number) => {
    if (!sample || disposed || !enabled) return;
    const now = context.currentTime;
    const rising = newDirection < 0;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const clip = { source, gain };
    source.buffer = sample;
    source.playbackRate.setValueAtTime(rising ? .96 : 1.08, now);
    source.playbackRate.linearRampToValueAtTime(rising ? 1.24 : .83, now + 2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.setTargetAtTime(.64, now, .025);
    source.connect(gain);
    gain.connect(motionGain);
    voices.add(clip);
    source.addEventListener("ended", () => {
      voices.delete(clip);
      source.disconnect();
      gain.disconnect();
    }, { once: true });
    source.start(now, rising ? 5.1 : .85, rising ? 2.25 : 2.5);
    nextPlayAt = now + (rising ? 1.65 : 1.85) / Math.min(1.25, Math.max(.8, speed));
    ticks++;
  };

  const unsubscribe = subscribeMotion(frame => {
    if (!enabled || context.state !== "running" || document.hidden) return;
    const velocity = frame.reduced ? 0 : frame.velocity;
    const speed = Math.min(3, Math.abs(velocity));
    const moving = speed > .018;
    const newDirection = moving ? Math.sign(velocity) : direction;
    if (moving && newDirection !== direction) {
      fadeVoices();
      direction = newDirection;
      nextPlayAt = 0;
    }
    if (moving && context.currentTime >= nextPlayAt) playWhoosh(direction, speed);
    const intensity = Math.min(1, speed / 1.35);
    const level = moving ? .58 * Math.sqrt(intensity) * (1 - frame.dark.blackout * .18) : 0;
    target(motionGain.gain, level, moving ? .055 : .14);

    analyser.getFloatTimeDomainData(meter);
    let peak = 0;
    for (const value of meter) peak = Math.max(peak, Math.abs(value));
    maxPeak = Math.max(maxPeak, peak);
    if (frame.time >= nextReport || frame.reduced) {
      nextReport = frame.time + .12;
      send(speed, peak);
    }
  });
  const visibility = () => {
    target(motionGain.gain, 0, .02);
    if (document.hidden) {
      context.suspend().catch(() => {});
      send(0, 0);
    } else if (enabled && !disposed) context.resume().catch(() => { enabled = false; interrupted(); });
  };
  document.addEventListener("visibilitychange", visibility);

  return {
    async enable() {
      clearTimeout(suspendTimer);
      await context.resume();
      await loadSample();
      if (disposed) return;
      enabled = true;
      nextPlayAt = 0;
      if (document.hidden) visibility();
      send(0, 0);
    },
    disable() {
      enabled = false;
      target(motionGain.gain, 0, .025);
      fadeVoices();
      suspendTimer = setTimeout(() => {
        if (!enabled && !disposed) context.suspend().catch(() => {});
      }, 240);
      send(0, 0);
    },
    dispose() {
      disposed = true;
      enabled = false;
      clearTimeout(suspendTimer);
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      voices.forEach(({ source }) => { try { source.stop(); } catch {} });
      context.close().catch(() => {});
    },
  };
}
