import { sceneTravelAt } from "./scene-motion";

export type CameraScene = { top: number; span: number; approach: number };

/** The exact camera mapping, shared by rendering and short audio look-ahead. */
export function cameraTravel(scroll: number, layout: CameraScene[]) {
  let index = 0;
  for (let i = 0; i < layout.length; i++) if (scroll >= layout[i].top) index = i;
  const active = layout[index];
  return active ? index + sceneTravelAt(scroll - active.top, active.span, active.approach) : 0;
}

/** Continue only the already-rendered easing toward the current native position.
 * This does not predict new wheel input, change the camera, or queue future cues.
 */
export function projectedCameraTravel(scroll: number, target: number, seconds: number, layout: CameraScene[]) {
  const projected = target + (scroll - target) * Math.exp(-14 * Math.max(0, seconds));
  return cameraTravel(Math.abs(projected - target) < .02 ? target : projected, layout);
}
