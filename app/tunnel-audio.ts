import { subscribeMotion } from "./motion-clock";

export type AudioTelemetry = { enabled: boolean; context: string; ticks: number; voices: number; speed: number; peak: number; maxPeak: number; clock: number };

/** Procedural Sci-Fi layers driven by the same smoothed travel clock as the tunnel camera. */
export function createTunnelAudio(report: (state: AudioTelemetry) => void, interrupted: () => void) {
  const context = new AudioContext({ latencyHint: "interactive" });
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  const analyser = context.createAnalyser();
  const voices = new Set<AudioBufferSourceNode | OscillatorNode>();
  const meter = new Float32Array(2048);
  const noise = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const noiseData = noise.getChannelData(0);
  for (let i = 0; i < noiseData.length; i++) noiseData[i] = (Math.random() * 2 - 1) * .8;

  master.gain.value = 0;
  compressor.threshold.value = -19; compressor.knee.value = 13;
  compressor.ratio.value = 5; compressor.attack.value = .005; compressor.release.value = .18;
  analyser.fftSize = 2048;
  master.connect(compressor); compressor.connect(analyser); analyser.connect(context.destination);

  let airSource: AudioBufferSourceNode | undefined;
  let airGain: GainNode | undefined;
  let airFilter: BiquadFilterNode | undefined;
  let enabled = false, disposed = false, seeded = false, moving = false;
  let previous = 0, previousSpeed = 0, activeScene = -1, ticks = 0, maxPeak = 0, nextReport = 0;
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
  const ensureAirLayer = () => {
    if (airSource) return;
    airFilter = context.createBiquadFilter(); airFilter.type = "bandpass"; airFilter.frequency.value = 260; airFilter.Q.value = .55;
    airGain = context.createGain(); airGain.gain.value = 0;
    airSource = addVoice(context.createBufferSource()); airSource.buffer = noise; airSource.loop = true;
    airSource.connect(airFilter); airFilter.connect(airGain); airGain.connect(master); airSource.start();
  };
  const subDrop = () => {
    if (!enabled || context.state !== "running") return;
    const oscillator = addVoice(context.createOscillator()), gain = context.createGain(), filter = context.createBiquadFilter(), now = context.currentTime;
    filter.type = "lowpass"; filter.frequency.value = 180; oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(78, now); oscillator.frequency.exponentialRampToValueAtTime(31, now + .72);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.13, now + .035); gain.gain.exponentialRampToValueAtTime(.0001, now + .9);
    oscillator.connect(filter); filter.connect(gain); gain.connect(master); oscillator.start(now); oscillator.stop(now + .94); ticks++;
  };
  const settleChime = () => {
    if (!enabled || context.state !== "running") return;
    const now = context.currentTime;
    for (const frequency of [248, 372]) {
      const oscillator = addVoice(context.createOscillator()), gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(.026, now + .018); gain.gain.exponentialRampToValueAtTime(.0001, now + .32);
      oscillator.connect(gain); gain.connect(master); oscillator.start(now); oscillator.stop(now + .38);
    }
  };

  const unsubscribe = subscribeMotion(frame => {
    const delta = seeded ? frame.travel - previous : 0;
    previous = frame.travel; seeded = true;
    if (!enabled || context.state !== "running" || document.hidden) return;
    ensureAirLayer();
    const speed = frame.reduced ? 0 : Math.min(3, Math.abs(frame.velocity));
    const intensity = Math.min(1, speed / 1.35), scene = Math.floor(frame.travel + .001), isMoving = speed > .008;
    target(airFilter!.frequency, 260 + intensity * 1850, .08);
    target(airGain!.gain, intensity * .095, .055);
    if (activeScene >= 0 && scene !== activeScene && Math.abs(delta) < .4) subDrop();
    activeScene = scene;
    if (!isMoving && moving && previousSpeed > .035) settleChime();
    moving = isMoving; previousSpeed = speed;
    analyser.getFloatTimeDomainData(meter);
    let peak = 0; for (const value of meter) peak = Math.max(peak, Math.abs(value));
    maxPeak = Math.max(maxPeak, peak);
    if (frame.time >= nextReport || frame.reduced) {
      nextReport = frame.time + .12;
      report({ enabled, context: context.state, ticks, voices: voices.size, speed, peak, maxPeak, clock: context.currentTime });
    }
  });
  const visibility = () => {
    seeded = false; activeScene = -1; moving = false;
    if (document.hidden) { context.suspend().catch(() => {}); report({ enabled, context: "suspended", ticks, voices: 0, speed: 0, peak: 0, maxPeak, clock: context.currentTime }); }
    else if (enabled && !disposed) context.resume().catch(() => { enabled = false; interrupted(); });
  };
  document.addEventListener("visibilitychange", visibility);
  return {
    async enable() { clearTimeout(suspendTimer); await context.resume(); if (disposed) return; ensureAirLayer(); enabled = true; seeded = false; activeScene = -1; target(master.gain, .65, .08); if (document.hidden) visibility(); },
    disable() { enabled = false; target(master.gain, 0, .025); target(airGain?.gain ?? master.gain, 0, .025); suspendTimer = setTimeout(() => { if (!enabled && !disposed) context.suspend().catch(() => {}); }, 140); report({ enabled, context: "muted", ticks, voices: 0, speed: 0, peak: 0, maxPeak, clock: context.currentTime }); },
    dispose() { disposed = true; enabled = false; clearTimeout(suspendTimer); unsubscribe(); document.removeEventListener("visibilitychange", visibility); voices.forEach(voice => { try { voice.stop(); } catch {} }); context.close().catch(() => {}); },
  };
}
