/** Spatial score, not a playlist: the same camera position selects the same mix
 * in either direction. No timers advance the scene while the camera is still. */
const scenes = [
  { id: "top", root: 73.42, texture: .36, depth: .20, signal: .035, harmonic: 3, cutoff: 700 },
  { id: "story", root: 98, texture: .18, depth: .18, signal: .10, harmonic: 2, cutoff: 950 },
  { id: "experience", root: 73.42, texture: .32, depth: .22, signal: .06, harmonic: 3, cutoff: 800 },
  { id: "year-2007", root: 110, texture: .17, depth: .13, signal: .17, harmonic: 4, cutoff: 1650 },
  { id: "year-2011", root: 98, texture: .20, depth: .23, signal: .07, harmonic: 2, cutoff: 850 },
  { id: "year-2013", root: 73.42, texture: .42, depth: .19, signal: .105, harmonic: 3, cutoff: 1300 },
  { id: "dark-crossing", root: 49, texture: .05, depth: .27, signal: .008, harmonic: 2, cutoff: 240 },
  { id: "year-2024", root: 146.83, texture: .16, depth: .14, signal: .16, harmonic: 3, cutoff: 1850 },
  { id: "connections", root: 98, texture: .24, depth: .19, signal: .12, harmonic: 3, cutoff: 1200 },
  { id: "projects", root: 110, texture: .32, depth: .14, signal: .14, harmonic: 4, cutoff: 1550 },
  { id: "contact", root: 73.42, texture: .12, depth: .24, signal: .065, harmonic: 2, cutoff: 650 },
] as const;

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const x = clamp(n); return x * x * (3 - 2 * x); };

export function sceneAudioScore(travel: number, velocity: number, blackout: number) {
  // Crossfade within 0.16 camera units either side of a scene boundary.
  const boundary = Math.max(1, Math.min(scenes.length - 1, Math.round(travel)));
  const blend = smooth((travel - boundary + .16) / .32);
  const a = scenes[boundary - 1], b = scenes[boundary];
  const mix = (x: number, y: number) => x + (y - x) * blend;
  // Power interpolation for the layer levels; frequency interpolation in log Hz.
  const power = (x: number, y: number) => Math.sqrt(mix(x * x, y * y));
  const root = Math.exp(mix(Math.log(a.root), Math.log(b.root)));
  const distance = travel - Math.round(travel);
  const proximity = smooth(1 - Math.abs(distance) / .22);
  const direction = Math.sign(velocity);
  const passing = smooth((distance * direction + .06) / .12);
  const approach = proximity * (1 - passing);
  const departure = proximity * passing;
  const speed = clamp(Math.abs(velocity) / 1.5);
  // Slow, spatially fixed articulation, not a time-running tremolo or soundtrack.
  const articulation = .84 + .16 * Math.cos(travel * Math.PI * 8);
  const darkness = clamp(blackout);
  return {
    scene: blend < .5 ? a.id : b.id, from: a.id, to: b.id, blend,
    root: root * (1 - darkness * .12),
    signalHz: root * mix(a.harmonic, b.harmonic) * (1 + direction * speed * .025),
    texture: power(a.texture, b.texture) * (1 - .8 * darkness) * (.8 + .2 * speed),
    depth: power(a.depth, b.depth) * (1 + .20 * approach),
    signal: power(a.signal, b.signal) * (1 - .96 * darkness) * articulation * (1 + .3 * departure),
    cutoff: mix(a.cutoff, b.cutoff) * (1 + .3 * speed + .35 * approach) * (1 - .65 * darkness),
    cueHz: root * (darkness > .8 ? 1 : 2),
    cueGain: (.10 + .045 * speed) * (1 - .75 * darkness),
    approach, departure,
  };
}

/** One cue per real plane crossing, rearmed only after leaving its vicinity.
 * Never replay skipped rings after an anchor jump, resume, or resize. */
export function ringCueTracker() {
  let previous: number | undefined;
  const locked = new Set<number>();
  return {
    reset(travel?: number) { previous = travel; locked.clear(); },
    update(travel: number, moving: boolean) {
      const before = previous; previous = travel;
      for (const ring of locked) if (before !== undefined && Math.abs(before - ring) > .09) locked.delete(ring);
      if (!moving || before === undefined || before === travel || Math.abs(travel - before) > .45) return null;
      const direction = Math.sign(travel - before);
      const ring = direction > 0 ? Math.floor(travel) : Math.ceil(travel);
      const crossed = direction > 0 ? before < ring && travel >= ring : before > ring && travel <= ring;
      if (!crossed || ring < 1 || ring > 10 || locked.has(ring)) return null;
      locked.add(ring);
      return { ring, direction };
    },
  };
}
