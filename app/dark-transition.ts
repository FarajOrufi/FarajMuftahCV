import { smoothstep } from "./scene-motion";

/** A single portal crossing shared by camera, blackout, fallback and audio. */
export function darkTransition(travel: number, index: number, reduced: boolean) {
  if (index < 0 || reduced) return { index, cover: 0, exit: 0, blackout: 0, approaching: false };
  // The camera gets close enough for the black disk to fill the viewport first.
  const cover = smoothstep((travel - (index - .12)) / .08);
  const exit = smoothstep((travel - index - .25) / .72);
  return {
    index,
    cover,
    exit,
    blackout: cover * (1 - exit),
    approaching: travel >= index - 1.15 && travel < index,
  };
}
