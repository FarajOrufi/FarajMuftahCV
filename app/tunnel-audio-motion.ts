import type { MotionFrame } from "./motion-clock";

/** Tube planes are at 8 + ring * 30; the camera is at 8 + travel * 30.
 * No wheel timer, delayed one-shot, or independent animation controls audio.
 */
export function motionSound(frame: MotionFrame) {
  const speed = frame.reduced ? 0 : Math.min(3, Math.abs(frame.velocity));
  const direction = Math.sign(frame.velocity);
  const strength = Math.pow(Math.min(1, speed / 1.5), .65);
  const ring = Math.round(frame.travel), distance = frame.travel - ring;
  const proximity = ring >= 1 && ring <= 11 ? Math.max(0, 1 - Math.abs(distance) / .22) : 0;
  const crossing = proximity * proximity * (3 - 2 * proximity);
  const moving = speed > .006;
  const tail = Math.min(1, Math.max(0, (speed - .006) / .034));
  const gate = tail * tail * (3 - 2 * tail);
  return {
    speed, direction, ring, crossing, distance,
    phase: !moving ? "still" : crossing === 0 ? "travel" : Math.abs(distance) < .035
      ? "crossing" : distance * direction < 0 ? "approach" : "departure",
    gain: .46 * strength * gate * (1 + .22 * crossing) * (1 - frame.dark.blackout * .32),
    rate: direction < 0 ? 1 + .135 * strength : 1 - .085 * strength,
    brightness: (620 + 900 * strength + 780 * crossing) * (1 - frame.dark.blackout * .48),
  };
}

/** Original periodic FM/additive design, not a trimmed whoosh.
 * Integer cycles in two seconds: waveform value AND slope continue at the seam.
 * Glass: warm 110 Hz core, restrained crystalline overtones, no noise layer.
 * Ion is a comparison candidate only. Generate once, never inside RAF.
 */
export function resonanceChannels(sampleRate: number, color: "glass" | "ion" = "glass") {
  const channels = [new Float32Array(sampleRate * 2), new Float32Array(sampleRate * 2)];
  const tau = Math.PI * 2;
  const frequencies = color === "glass" ? [110, 220, 221.5, 331.5, 551.5] : [75, 150, 226.5, 451.5, 751.5];
  const weights = color === "glass" ? [.38, .23, .065, .105, .055] : [.38, .22, .09, .115, .065];
  // Oscillator recurrence avoids ~1 million trig calls during first unlock.
  // Shared phase also keeps stereo coherent; drift over two seconds is negligible.
  const oscillators = frequencies.map((frequency, partial) => ({
    sin: 0, cos: 1, stepSin: Math.sin(tau * frequency / sampleRate), stepCos: Math.cos(tau * frequency / sampleRate),
    spreadSin: Math.sin(partial > 1 ? .16 * partial : 0), spreadCos: Math.cos(partial > 1 ? .16 * partial : 0),
  }));
  let modSin = 0, modCos = 1;
  const modStepSin = Math.sin(tau * 55 / sampleRate), modStepCos = Math.cos(tau * 55 / sampleRate);
  for (let i = 0; i < channels[0].length; i++) {
    const modulation = (color === "glass" ? .28 : .7) * modSin;
    const fmSin = Math.sin(modulation), fmCos = Math.cos(modulation);
    let left = 0, right = 0;
    for (let partial = 0; partial < oscillators.length; partial++) {
      const oscillator = oscillators[partial];
      const sin = oscillator.sin * fmCos + oscillator.cos * fmSin;
      const cos = oscillator.cos * fmCos - oscillator.sin * fmSin;
      left += weights[partial] * sin;
      right += weights[partial] * (sin * oscillator.spreadCos + cos * oscillator.spreadSin);
      const next = oscillator.sin * oscillator.stepCos + oscillator.cos * oscillator.stepSin;
      oscillator.cos = oscillator.cos * oscillator.stepCos - oscillator.sin * oscillator.stepSin;
      oscillator.sin = next;
    }
    channels[0][i] = left; channels[1][i] = right;
    const next = modSin * modStepCos + modCos * modStepSin;
    modCos = modCos * modStepCos - modSin * modStepSin; modSin = next;
  }
  let peak = 0;
  for (const channel of channels) for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
  for (const channel of channels) for (let i = 0; i < channel.length; i++) channel[i] *= .68 / peak;
  return channels;
}
