import { subscribeMotion } from "./motion-clock";

export type AudioTelemetry = { enabled: boolean; context: string; ticks: number; voices: number; speed: number; peak: number; maxPeak: number; clock: number };

/** Audio follows the same smoothed path distance as the camera, never raw wheel events. */
export function createTunnelAudio(report: (state: AudioTelemetry) => void, interrupted: () => void) {
  const context = new AudioContext({ latencyHint: "interactive" });
  const abort = new AbortController();
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const analyser = context.createAnalyser();
  master.gain.value = 0;
  compressor.threshold.value = -18; compressor.knee.value = 12;
  compressor.ratio.value = 5; compressor.attack.value = .005; compressor.release.value = .15;
  analyser.fftSize = 2048;
  master.connect(compressor); compressor.connect(analyser); analyser.connect(context.destination);
  const meter = new Float32Array(analyser.fftSize);
  const voices = new Set<AudioBufferSourceNode>();
  let buffer: Promise<AudioBuffer> | undefined;
  let click: AudioBuffer | undefined;
  let maxPeak = 0;
  let enabled = false, disposed = false, seeded = false, previous = 0, accumulated = 0, lastTick = -1, ticks = 0, nextReport = 0;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;
  const smooth = (param: AudioParam, value: number, seconds: number) => {
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  };
  const load = (path: string) => fetch(path, { signal: abort.signal }).then(response => {
    if (!response.ok) throw new Error(`Audio unavailable: ${response.status}`);
    return response.arrayBuffer();
  }).then(data => context.decodeAudioData(data));
  const tick = (strength: number) => {
    if (!click || voices.size >= 2) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = click;
    // Preserve the selected mouse click's pitch; only cadence follows travel.
    gain.gain.value = .42 + Math.min(.14, strength * .08);
    source.connect(gain); gain.connect(master); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(); ticks++;
  };
  const unsubscribe = subscribeMotion(frame => {
    const delta = seeded ? frame.travel - previous : 0;
    previous = frame.travel; seeded = true;
    if (!enabled || context.state !== "running" || document.hidden) return;
    const speed = frame.reduced ? 0 : Math.min(3, Math.abs(delta) / frame.dt);
    const moving = speed > .008;
    if (!moving || Math.abs(delta) > .4) accumulated = 0;
    else {
      accumulated += Math.abs(delta);
      if (accumulated >= .023 && context.currentTime - lastTick >= .1) {
        tick(speed); lastTick = context.currentTime; accumulated %= .023;
      }
    }
    analyser.getFloatTimeDomainData(meter);
    let peak = 0;
    for (const value of meter) peak = Math.max(peak, Math.abs(value));
    maxPeak = Math.max(maxPeak, peak);
    if (frame.time >= nextReport || frame.reduced) {
      nextReport = frame.time + .12;
      report({ enabled, context: context.state, ticks, voices: voices.size, speed, peak, maxPeak, clock: context.currentTime });
    }
  });
  const visibility = () => {
    seeded = false; accumulated = 0;
    if (document.hidden) {
      voices.forEach(source => source.stop());
      context.suspend().catch(() => {});
      report({ enabled, context: "suspended", ticks, voices: 0, speed: 0, peak: 0, maxPeak, clock: context.currentTime });
    } else if (enabled && !disposed) {
      context.resume().catch(() => { enabled = false; interrupted(); });
    }
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    async enable() {
      clearTimeout(suspendTimer);
      // Called directly from the button gesture, before fetching/decoding assets.
      const resumed = context.resume();
      buffer ??= load("/audio/tunnel-mouse-click.wav");
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => { abort.abort(); reject(new Error("Audio activation timed out")); }, 15000);
      });
      const [, sample] = await Promise.race([Promise.all([resumed, buffer]), deadline]).finally(() => clearTimeout(timeout));
      if (disposed) return;
      click = sample;
      enabled = true; seeded = false; accumulated = 0;
      smooth(master.gain, .65, .06);
      if (document.hidden) visibility();
    },
    disable() {
      enabled = false; accumulated = 0;
      smooth(master.gain, 0, .018);
      voices.forEach(source => source.stop(context.currentTime + .1));
      suspendTimer = setTimeout(() => { if (!enabled && !disposed) context.suspend().catch(() => {}); }, 140);
      report({ enabled, context: "muted", ticks, voices: 0, speed: 0, peak: 0, maxPeak, clock: context.currentTime });
    },
    dispose() {
      disposed = true; enabled = false; abort.abort(); clearTimeout(suspendTimer); unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      voices.forEach(source => source.stop());
      context.close().catch(() => {});
    },
  };
}
