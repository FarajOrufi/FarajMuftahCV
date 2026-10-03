export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Shared timing keeps the camera tunnel and the typography on the same beat. */
export const sceneTravel = (progress: number) => {
  const p = clamp01(progress);
  if (p < 0.28) return smoothstep(p / 0.28) * 0.18;
  if (p < 0.66) return 0.18 + ((p - 0.28) / 0.38) * 0.13;
  return 0.31 + smoothstep((p - 0.66) / 0.34) * 0.69;
};

