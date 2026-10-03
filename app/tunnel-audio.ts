import { subscribeMotion } from "./motion-clock";

export type AudioTelemetry = { enabled: boolean; context: string; ticks: number; voices: number; speed: number; peak: number; maxPeak: number; clock: number };

/** A directional space-whoosh shaped by the tunnel camera's shared motion clock. */
export function createTunnelAudio(report: (state: AudioTelemetry) => void, interrupted: () => void) {
  const context = new AudioContext({ latencyHint: "interactive" });
  const master = context.createGain();
  const motionGain = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const analyser = context.createAnalyser();
  const voices = new Set<AudioBufferSourceNode | OscillatorNode>();
  const meter = new Float32Array(2048);
  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

  master.gain.value = 0;
  motionGain.gain.value = 0;
  compressor.threshold.value = -17;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = .012;
  compressor.release.value = .22;
  analyser.fftSize = 2048;
  motionGain.connect(master);
  master.connect(compressor);
  compressor.connect(analyser);
  analyser.connect(context.destination);

  let airFilter: BiquadFilterNode | undefined;
  let airGain: GainNode | undefined;
  let lowTone: OscillatorNode | undefined;
  let shimmer: OscillatorNode | undefined;
  let enabled = false, disposed = false, direction = 0;
  let ticks = 0, maxPeak = 0, nextReport = 0;
  let suspendTimer: ReturnType<typeof setTimeout> | undefined;

  const target = (param: AudioParam, value: number, seconds: number) => {
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  };
  const addVoice = <T extends AudioBufferSourceNode | OscillatorNode>(voice: T) => {
    voices.add(voice);
    voice.addEventListener("ended", () => voices.delete(voice), { once: true });
    return voice;
  };
  const ensureLayers = () => {
    if (airFilter) return;
    airFilter = context.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.frequency.value = 360;
    airFilter.Q.value = .55;
    airGain = context.createGain();
    airGain.gain.value = .31;
    const air = addVoice(context.createBufferSource());
    air.buffer = noise;
    air.loop = true;
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(motionGain);
    air.start();

    lowTone = addVoice(context.createOscillator());
    lowTone.type = "sine";
    lowTone.frequency.value = 68;
    const lowGain = context.createGain();
    lowGain.gain.value = .2;
    lowTone.connect(lowGain);
    lowGain.connect(motionGain);
    lowTone.start();

    shimmer = addVoice(context.createOscillator());
    shimmer.type = "sine";
    shimmer.frequency.value = 137;
    const shimmerGain = context.createGain();
    shimmerGain.gain.value = .024;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(motionGain);
    shimmer.start();
  };

  const unsubscribe = subscribeMotion(frame => {
    if (!enabled || context.state !== "running" || document.hidden) return;
    ensureLayers();
    const velocity = frame.reduced ? 0 : frame.velocity;
    const speed = Math.min(3, Math.abs(velocity));
    const intensity = Math.min(1, speed / 1.35);
    const nextDirection = speed > .018 ? Math.sign(velocity) : direction;
    if (nextDirection !== direction) { direction = nextDirection; ticks++; }
    const rising = direction < 0;
    const darkness = frame.dark.blackout;

    // Filtered air gives the zoom its movement; the two soft tones give it depth.
    target(airFilter!.frequency, (rising ? 470 : 260) + intensity * (rising ? 1050 : 710), .085);
    target(airGain!.gain, .31 * (1 - darkness * .4), .12);
    target(lowTone!.frequency, (rising ? 91 : 59) + intensity * (rising ? 19 : 12), .12);
    target(shimmer!.frequency, (rising ? 183 : 119) + intensity * (rising ? 38 : 24), .15);
    target(motionGain.gain, intensity > .006 ? .8 * Math.sqrt(intensity) : 0, intensity > .006 ? .075 : .12);
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
    target(motionGain.gain, 0, .025);
    if (document.hidden) {
      context.suspend().catch(() => {});
      report({ enabled, context: "suspended", ticks, voices: 0, speed: 0, peak: 0, maxPeak, clock: context.currentTime });
    } else if (enabled && !disposed) context.resume().catch(() => { enabled = false; interrupted(); });
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    async enable() {
      clearTimeout(suspendTimer);
      await context.resume();
      if (disposed) return;
      ensureLayers();
      enabled = true;
      target(master.gain, .6, .08);
      if (document.hidden) visibility();
    },
    disable() {
      enabled = false;
      target(master.gain, 0, .025);
      target(motionGain.gain, 0, .025);
      suspendTimer = setTimeout(() => { if (!enabled && !disposed) context.suspend().catch(() => {}); }, 140);
      report({ enabled, context: "muted", ticks, voices: 0, speed: 0, peak: 0, maxPeak, clock: context.currentTime });
    },
    dispose() {
      disposed = true;
      enabled = false;
      clearTimeout(suspendTimer);
      unsubscribe();
      document.removeEventListener("visibilitychange", visibility);
      voices.forEach(voice => { try { voice.stop(); } catch {} });
      context.close().catch(() => {});
    },
  };
}
