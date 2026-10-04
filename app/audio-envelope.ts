/** Track our own exponential automation, including its instantaneous value.
 * Retarget from that value, never from an old target or a .value snapshot.
 * The explicit hold works even where cancelAndHoldAtTime is unavailable.
 */
export function audioEnvelope(param: AudioParam, initial: number, time: number) {
  let from = initial, goal = initial, start = time, tau = .006;
  let expiry: { at: number; tau: number } | undefined;
  const valueAt = (at: number) => {
    const end = expiry ? Math.min(at, expiry.at) : at;
    const value = goal + (from - goal) * Math.exp(-Math.max(0, end - start) / tau);
    return expiry && at > expiry.at ? value * Math.exp(-(at - expiry.at) / expiry.tau) : value;
  };
  return {
    valueAt,
    target(value: number, at: number, seconds: number) {
      if (value === goal && seconds === tau && !expiry) return;
      const held = valueAt(at);
      param.cancelScheduledValues(at);
      param.setValueAtTime(held, at);
      param.setTargetAtTime(value, at, seconds);
      from = held; goal = value; start = at; tau = seconds;
      expiry = undefined;
    },
    // Audio-clock safety fade if rendering stalls, even if JS timers are throttled.
    expire(at: number, seconds: number) {
      param.setTargetAtTime(0, at, seconds); expiry = { at, tau: seconds };
    },
    reset(value: number, at: number) {
      param.cancelScheduledValues(at); param.setValueAtTime(value, at);
      from = goal = value; start = at; expiry = undefined;
    },
  };
}

export function audioOutputDelay(context: Pick<AudioContext, "currentTime" | "baseLatency" | "outputLatency" | "getOutputTimestamp">, nowMs: number) {
  const stamp = context.getOutputTimestamp?.();
  const mapped = typeof stamp?.performanceTime === "number" && stamp.performanceTime > 0
    && typeof stamp.contextTime === "number" && stamp.contextTime > 0
    ? (stamp.performanceTime - nowMs) / 1000 + context.currentTime - stamp.contextTime : NaN;
  // Startup/unsupported timestamp: browser-reported output + graph latency.
  const fallback = (context.baseLatency || 0) + (context.outputLatency || 0);
  return Number.isFinite(mapped) && mapped >= Math.max(0, fallback * .35) && mapped <= .2 ? mapped : Math.max(0, fallback);
}
