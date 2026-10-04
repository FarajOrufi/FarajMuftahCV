import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(name, globals = {}, modules = {}) {
  const source = readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  runInNewContext(code, { exports, require: path => modules[path], ...globals });
  return exports;
}
const { motionSound, resonanceChannels } = load("tunnel-audio-motion");
const { audioEnvelope, audioOutputDelay } = load("audio-envelope");
const scoreModule = load("scene-audio-score");
const { sceneAudioScore, ringCueTracker } = scoreModule;
const layerModule = load("scene-audio-layers", {}, { "./audio-envelope": { audioEnvelope } });
const profiles = Array.from({ length: 11 }, (_, i) => sceneAudioScore(i + .3, .7, i === 6 ? 1 : 0));
assert.equal(new Set(profiles.map(p => [p.texture, p.root, p.signal, p.cutoff].join())).size, 11, "Every scene has a distinct spatial mix");
assert.equal(profiles[6].scene, "dark-crossing");
assert.ok(profiles[6].signal < profiles[7].signal / 20, "Black passage removes bright signal; 2024 restores it");
for (let i = 1; i <= 10; i++) {
  const before = sceneAudioScore(i - .000001, .8, 0), after = sceneAudioScore(i + .000001, .8, 0);
  for (const key of ["root", "texture", "signal", "depth", "cutoff"]) assert.ok(Math.abs(before[key] - after[key]) / Math.max(.001, before[key]) < .0001, `Continuous ${key} across boundary ${i}`);
  const forward = sceneAudioScore(i + .3, .5, 0), reverse = sceneAudioScore(i + .3, -.5, 0);
  assert.equal(forward.scene, reverse.scene); assert.equal(forward.root, reverse.root);
}
const cueTracker = ringCueTracker();
cueTracker.reset(2.8);
assert.equal(cueTracker.update(2.98, true), null);
assert.equal(cueTracker.update(3.01, true).ring, 3);
assert.equal(cueTracker.update(2.99, true), null, "Boundary jitter cannot retrigger");
cueTracker.update(3.15, true);
assert.equal(cueTracker.update(2.99, true).direction, -1, "A deliberate return rearms reverse crossing");
assert.equal(cueTracker.update(7.2, true), null, "Skipped rings never queue up");
cueTracker.reset(7.8);
assert.equal(cueTracker.update(8.01, false), null, "Idle/reflow cannot emit a cue");
const sceneMotion = load("scene-motion");
const { cameraTravel, projectedCameraTravel } = load("camera-travel", {}, { "./scene-motion": sceneMotion });
const params = [], calls = [];
const fakeParam = {
  cancelScheduledValues: at => calls.push(["cancel", at]),
  setValueAtTime: (value, at) => { params.push(value); calls.push(["hold", at]); },
  setTargetAtTime: (_, at) => calls.push(["target", at]),
};
const envelope = audioEnvelope(fakeParam, 0, 0);
envelope.target(1, 0, .006);
const held = envelope.valueAt(.003);
envelope.target(.2, .003, .006);
assert.ok(Math.abs(params.at(-1) - held) < 1e-12, "Retarget holds the in-flight value, not the previous target");
assert.equal(envelope.valueAt(.003), held, "No instantaneous envelope discontinuity");
const callCount = calls.length;
envelope.target(.2, .004, .006);
assert.equal(calls.length, callCount, "Repeated identical target does not replace its automation");
envelope.reset(0, .005);
assert.equal(envelope.valueAt(.2), 0, "Hard lifecycle reset clears previous envelope");
envelope.target(.5, .01, .004);
envelope.expire(.13, .008);
assert.ok(envelope.valueAt(.20) < .0001, "No stale audio when rendering stops, even without JS timer callbacks");
const afterExpiry = envelope.valueAt(.21);
envelope.target(.5, .21, .004);
assert.equal(params.at(-1), afterExpiry, "Resuming after watchdog fade does not jump to the old target");
assert.ok(Math.abs(audioOutputDelay({ currentTime: 2, getOutputTimestamp: () => ({ contextTime: 1.95, performanceTime: 1000 }) }, 1000) - .05) < 1e-10);
assert.equal(audioOutputDelay({ currentTime: 2, baseLatency: .01, outputLatency: .04 }, 1000), .05);
assert.equal(audioOutputDelay({ currentTime: 2, baseLatency: .01, getOutputTimestamp: () => ({ contextTime: 0, performanceTime: 0 }) }, 1000), .01);
assert.equal(audioOutputDelay({ currentTime: 2, baseLatency: .01, getOutputTimestamp: () => ({ contextTime: 1, performanceTime: 1000 }) }, 1000), .01, "Invalid timestamp does not become excessive anticipation");
assert.equal(audioOutputDelay({ currentTime: 2, baseLatency: .01, outputLatency: .04, getOutputTimestamp: () => ({ contextTime: 1.998, performanceTime: 1000 }) }, 1000), .05, "Transient resume timestamp cannot erase the known device delay");
const layout = Array.from({ length: 12 }, (_, i) => ({ top: i * 900, span: 900, approach: i === 5 ? 360 : 0 }));
let worstOldError = 0, worstProjectedError = 0;
for (const direction of [-1, 1]) for (let i = 1; i <= 10; i++) {
  const scroll = i * 900 + direction * -120, target = scroll + direction * 220;
  let stepped = scroll;
  for (let k = 0; k < 3; k++) stepped += (target - stepped) * (1 - Math.exp(-14 / 60));
  const actual = cameraTravel(stepped, layout);
  worstOldError = Math.max(worstOldError, Math.abs(actual - cameraTravel(scroll, layout)));
  worstProjectedError = Math.max(worstProjectedError, Math.abs(actual - projectedCameraTravel(scroll, target, .05, layout)));
}
assert.ok(worstOldError > .04, "Baseline spatial lag is measurable around ring planes");
assert.ok(worstProjectedError < 1e-12, "Known easing projection matches three subsequent visual frames exactly");
assert.equal(projectedCameraTravel(4500, 4500, .06, layout), cameraTravel(4500, layout), "Stationary position never anticipates a crossing");
const frame = (velocity, travel = 3.5, reduced = false, blackout = 0) => ({
  velocity, travel, reduced, width: 1280, height: 720, dark: { blackout }, time: 0, dt: 1 / 60,
});
assert.equal(motionSound(frame(0, 3)).gain, 0, "No background sound at a ring");
assert.equal(motionSound(frame(3, 3, true)).gain, 0, "Reduced motion is silent");
assert.ok(motionSound(frame(.8)).gain > motionSound(frame(.08)).gain);
assert.ok(motionSound(frame(-.8)).rate > motionSound(frame(.8)).rate);
assert.equal(motionSound(frame(.8, 3)).crossing, 1);
assert.equal(motionSound(frame(.8, 3.5)).crossing, 0);
assert.ok(Math.abs(motionSound(frame(.8, 2.9999)).gain - motionSound(frame(.8, 3.0001)).gain) < .00001);
assert.ok(motionSound(frame(.8, 6, false, 1)).gain > 0, "Black passage remains motion-linked");
assert.equal(motionSound(frame(.8, 2.9)).phase, "approach");
assert.equal(motionSound(frame(.8, 3)).phase, "crossing");
assert.equal(motionSound(frame(.8, 3.1)).phase, "departure");
assert.equal(motionSound(frame(-.8, 3.1)).phase, "approach");
assert.equal(motionSound(frame(-.8, 2.9)).phase, "departure");
assert.ok(motionSound(frame(.8, 3)).brightness > motionSound(frame(.8, 3.5)).brightness);
assert.ok(motionSound(frame(3)).gain < .57, "Bounded output even at maximum speed");
assert.ok(motionSound(frame(.006001)).gain < 1e-8, "Soft knee joins silence continuously instead of dropping an audible tail");
assert.ok(Math.abs(motionSound(frame(-.000001)).rate - motionSound(frame(.000001)).rate) < .0001, "Pitch reversal remains continuous near rest");
const sr = 4800;
for (const candidate of ["glass", "ion"]) {
  const channels = resonanceChannels(48000, candidate);
  for (const loop of channels) {
    assert.equal(loop.length, 96000);
    assert.ok(loop.every(x => Number.isFinite(x) && Math.abs(x) <= .681));
    const before = loop.at(-1) - loop.at(-2), seam = loop[0] - loop.at(-1), after = loop[1] - loop[0];
    assert.ok(Math.abs(seam - (before + after) / 2) < .001, "Loop boundary is an ordinary neighboring sample step");
    assert.ok(Math.abs(before - seam) < .002 && Math.abs(seam - after) < .002, "Loop slope continuity");
  }
}

let listener, telemetry, sources = [], visibility, fetchCount = 0, decodeCount = 0;
class Param {
  value = 0;
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param();
  threshold = new Param(); knee = new Param(); ratio = new Param();
  attack = new Param(); release = new Param(); playbackRate = new Param();
  connect() {} disconnect() {}
  getFloatTimeDomainData(meter) { meter.fill(0); }
  addEventListener(_, callback) { this.ended = callback; }
  start(...args) { this.startArgs = args; sources.push(this); }
  stop(time = context.currentTime) { this.stopAt = time; }
}
const buffer = (channels, length, sampleRate) => {
  const data = Array.from({ length: channels }, () => Float32Array.from({ length }, (_, i) => .3 * Math.sin(i * .09)));
  return { duration: length / sampleRate, sampleRate, numberOfChannels: channels,
    getChannelData: index => data[index], copyToChannel: (values, index) => data[index].set(values) };
};
let context;
class Context {
  currentTime = 0; state = "running"; destination = {}; sampleRate = sr;
  createGain() { return new Node(); } createBiquadFilter() { return new Node(); }
  createDynamicsCompressor() { return new Node(); } createAnalyser() { return new Node(); }
  createBufferSource() { return new Node(); }
  createOscillator() { return new Node(); }
  createBuffer(...args) { return buffer(...args); }
  async decodeAudioData() { decodeCount++; return buffer(2, Math.round(sr * 1.828571), sr); }
  async resume() { this.state = "running"; } async suspend() { this.state = "suspended"; }
  async close() { this.state = "closed"; }
}
const doc = { hidden: false, addEventListener: (_, callback) => { visibility = callback; }, removeEventListener() {} };
const { createTunnelAudio } = load("tunnel-audio", {
  AudioContext: function () { context = new Context(); return context; }, performance: { now: () => context.currentTime * 1000 },
  process: { env: { NODE_ENV: "development" } },
  document: doc, setTimeout, clearTimeout, AbortController,
  fetch: async (url, options) => {
    assert.equal(url, "/audio/dark-oscillator-motion-v1.wav", "Only the selected local derivative is fetched");
    assert.ok(options.signal, "Loading is abortable on teardown"); fetchCount++;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  },
}, { "./tunnel-audio-motion": { motionSound }, "./audio-envelope": { audioEnvelope, audioOutputDelay },
  "./scene-audio-score": scoreModule, "./scene-audio-layers": layerModule,
  "./motion-clock": { subscribeMotion: callback => { listener = callback; return () => { listener = undefined; }; } } });
assert.equal(context, undefined, "Import/SSR does not instantiate Web Audio");
const engine = createTunnelAudio(value => { telemetry = value; }, () => assert.fail("Unexpected interruption"));
assert.equal(sources.length, 0, "No autoplay on construction");
await engine.enable();
assert.equal(sources.length, 0, "Enable is not ambient playback");
assert.equal(telemetry.source, "mixkit-dark-synth-oscillator-646");
assert.equal(telemetry.revision, "spatial-scene-score-v3");
assert.ok(telemetry.loopSeconds > 1.8 && telemetry.loopSeconds < 1.9);
assert.equal(fetchCount, 1);
const step = (velocity, travel, dt = .02, reduced = false) => {
  context.currentTime += dt;
  for (const source of sources) if (source.stopAt <= context.currentTime && !source.finished) { source.finished = true; source.ended?.(); }
  listener({ ...frame(velocity, travel, reduced), time: context.currentTime });
};
step(0, 3);
assert.equal(sources.length, 0);
step(.5, 3.01);
const textures = () => sources.filter(source => source.loop === true);
assert.equal(sources.length, 3, "Texture, depth and signal start on first moving frame");
assert.equal(sources[0].loop, true);
assert.equal(sources[0].startArgs[0], context.currentTime, "First moving frame uses the audio clock immediately");
for (let i = 0; i < 250; i++) step(.5, 3.01 + i * .01);
assert.equal(textures().length, 1, "No texture restart during sustained travel across rings");
assert.ok(telemetry.cueCount >= 2, "Crossings produce real finite cues, not diagnostics alone");
assert.ok(telemetry.qa.maxVoices <= 5, "Two tonal voices, texture, one cue plus bounded cancellation fade");
for (let i = 0; i < 3; i++) step(0, 5.5);
step(.5, 5.51);
assert.equal(textures().length, 1, "Wheel gaps do not retrigger the sample");
for (let i = 0; i < 12; i++) step(i % 2 ? -.6 : .6, 5.5);
assert.equal(textures().length, 1, "Reversal changes pitch without restarting the waveform");
assert.ok(telemetry.voices <= 5, "Bounded layers, including rapid reversal");
for (let i = 0; i < 30; i++) step(0, 5.5);
assert.equal(telemetry.gain, 0);
assert.equal(telemetry.voices, 0, "Idle nodes are released");
assert.equal(telemetry.envelopeGain, 0, "Stopped envelope reaches exact zero");
step(.8, 5.6);
step(.8, 5.7, .5);
assert.equal(telemetry.phase, "stalled");
assert.equal(telemetry.gain, 0);
assert.equal(telemetry.voices, 0, "A throttled renderer cannot sustain a disconnected movement sound");
assert.equal(telemetry.stalledFrames, 1);
step(.8, 5.71);
assert.equal(telemetry.voices, 3, "Healthy rendering resumes normally after a stall");
context.baseLatency = .01; context.outputLatency = .04;
listener({ ...frame(.8, 5.8), time: context.currentTime, project: seconds => {
  assert.ok(seconds >= .006 && seconds <= .08, "Device change adapts within the bounded look-ahead window");
  return { travel: 5.95, dark: { blackout: .5 } };
} });
step(.8, 5.81);
assert.equal(telemetry.voices, 3);
listener({ ...frame(0, 5.8), time: context.currentTime + .1, project: () => assert.fail("Still camera must not anticipate sound") });
const countBeforeResize = sources.length;
listener({ ...frame(3, 6), width: 390, height: 844, time: context.currentTime });
assert.equal(sources.length, countBeforeResize, "Layout changes cannot trigger a scroll sound");
listener({ ...frame(0, 6), time: context.currentTime });
step(-.5, 5.49);
assert.equal(sources.at(-1).startArgs.length, 1, "No fixed MP3 duration determines travel sound");
step(.5, 5.5, .02, true);
for (let i = 0; i < 20; i++) step(0, 5.5, .02, true);
assert.equal(telemetry.voices, 0);
step(.5, 5.51);
doc.hidden = true; visibility();
assert.equal(context.state, "suspended");
doc.hidden = false; visibility();
await Promise.resolve();
assert.equal(context.state, "running");
engine.disable();
assert.equal(telemetry.enabled, false);
const countMuted = sources.length;
step(.8, 5.8);
assert.equal(sources.length, countMuted, "No playback while muted");
await engine.enable();
assert.equal(fetchCount, 1, "Mute/unmute reuses decoded audio, without fetching or decoding again");
assert.equal(decodeCount, 1);
step(0, 5.8);
step(.8, 5.81);
assert.equal(telemetry.enabled, true);
engine.disable();
// Frozen audio-clock regression observed in the in-app browser: stopAt cannot fire.
// The wall-clock cleanup still disconnects the source before suspending the context.
await new Promise(resolve => setTimeout(resolve, 110));
assert.equal(telemetry.voices, 0, "Mute releases sources even with a frozen audio clock");
assert.equal(telemetry.context, "suspended");
assert.equal(telemetry.meterLive, false, "A suspended analyser is not advertised as live output");
engine.dispose();
engine.dispose();
assert.equal(listener, undefined);
assert.equal(context.state, "closed");

const failureFactory = fetcher => load("tunnel-audio", {
  AudioContext: function () { context = new Context(); return context; },
  performance: { now: () => context.currentTime * 1000 },
  process: { env: { NODE_ENV: "development" } }, document: doc,
  setTimeout, clearTimeout, AbortController, fetch: fetcher,
}, { "./tunnel-audio-motion": { motionSound }, "./audio-envelope": { audioEnvelope, audioOutputDelay },
  "./scene-audio-score": scoreModule, "./scene-audio-layers": layerModule,
  "./motion-clock": { subscribeMotion: callback => { listener = callback; return () => { listener = undefined; }; } },
}).createTunnelAudio;
const missing = failureFactory(async () => ({ ok: false, status: 404 }))(() => {}, () => {});
const beforeFailure = sources.length;
await assert.rejects(missing.enable(), /Motion sound unavailable \(404\)/);
assert.equal(sources.length, beforeFailure, "Missing source cannot silently fall back to old sound");
missing.dispose();
assert.equal(context.state, "closed");
let pendingSignal;
const pendingEngine = failureFactory((_, { signal }) => {
  pendingSignal = signal;
  return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("download aborted")), { once: true }));
})(() => {}, () => {});
const pendingEnable = pendingEngine.enable();
pendingEngine.dispose();
await assert.rejects(pendingEnable, /download aborted/);
assert.equal(pendingSignal.aborted, true);
assert.equal(context.state, "closed");
assert.equal(listener, undefined, "Remount cleanup cancels in-flight loading and motion subscription");
// Verify the actual prepared WAV, not just the earlier procedural candidates.
const wav = readFileSync(new URL("../public/audio/dark-oscillator-motion-v1.wav", import.meta.url));
assert.equal(wav.toString("ascii", 0, 4), "RIFF");
assert.equal(wav.readUInt16LE(22), 2);
assert.equal(wav.readUInt32LE(24), 44100);
const loops = [[], []];
for (let i = 44; i < wav.length; i += 4) for (let c = 0; c < 2; c++) loops[c].push(wav.readInt16LE(i + c * 2) / 32768);
for (const loop of loops) {
  assert.ok(loop.every(value => Math.abs(value) <= .621));
  const seam = loop[0] - loop.at(-1), before = loop.at(-1) - loop.at(-2), after = loop[1] - loop[0];
  assert.ok(Math.abs(seam - (before + after) / 2) < .002, "Prepared source has no seam discontinuity");
}
console.log("PASS: 11 distinct continuous scene mixes, dark-to-2024 contrast, bidirectional rearmed crossing cues, no skipped-cue backlog, bounded five-voice graph, exact camera projection, latency fallback, soft stop/reversal/stall safety, prepared loop seam, no autoplay, idle/reflow/reduced-motion/visibility/mute cleanup, cache reuse, failure/abort and idempotent teardown.");
