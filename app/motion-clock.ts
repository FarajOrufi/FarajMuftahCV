import { cameraTravel, projectedCameraTravel, type CameraScene } from "./camera-travel";
import { darkTransition } from "./dark-transition";

export type MotionFrame = { scroll: number; width: number; height: number; time: number; dt: number; reduced: boolean; travel: number; velocity: number; dark: ReturnType<typeof darkTransition>;
  project?: (seconds: number) => Pick<MotionFrame, "travel" | "dark"> };
const listeners = new Set<(frame: MotionFrame) => void>();
let stop: (() => void) | undefined;

/** A single clock for the camera and typography. Native scrolling remains accessible. */
export function subscribeMotion(listener: (frame: MotionFrame) => void) {
  listeners.add(listener);
  if (!stop) stop = start();
  return () => { listeners.delete(listener); if (!listeners.size) { stop?.(); stop = undefined; } };
}

function start() {
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0, previous = 0, time = 0, scroll = window.scrollY, previousTravel = 0;
  let layout: CameraScene[] = [];
  let darkIndex = -1;
  const measure = () => {
    const sections = [...document.querySelectorAll<HTMLElement>(".zoom-scene")];
    darkIndex = sections.findIndex(section => section.classList.contains("dark-tunnel-scene"));
    layout = sections.map(section => ({
      top: section.getBoundingClientRect().top + window.scrollY,
      span: Math.max(1, section.offsetHeight - innerHeight),
      approach: Number(section.dataset.approach ?? 0) * innerHeight,
    }));
    schedule();
  };
  const tick = (now: number) => {
    raf = 0;
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 60;
    previous = now;
    if (!preference.matches) time += dt;
    const targetScroll = window.scrollY;
    scroll += (targetScroll - scroll) * (preference.matches ? 1 : 1 - Math.exp(-14 * dt));
    if (Math.abs(scroll - targetScroll) < .02) scroll = targetScroll;
    const travel = cameraTravel(scroll, layout);
    const cameraScroll = scroll, scenes = layout, portal = darkIndex;
    const reduced = preference.matches, portalReduced = reduced || innerHeight <= 600;
    const state = { scroll, width: innerWidth, height: innerHeight, time, dt, reduced: preference.matches, travel, velocity: (travel - previousTravel) / dt,
      dark: darkTransition(travel, darkIndex, portalReduced),
      project: (seconds: number) => {
        const nextTravel = reduced ? travel : projectedCameraTravel(cameraScroll, targetScroll, Math.min(.08, Math.max(0, seconds)), scenes);
        return { travel: nextTravel, dark: darkTransition(nextTravel, portal, portalReduced) };
      } };
    previousTravel = travel;
    listeners.forEach(callback => callback(state));
    if (!preference.matches && !document.hidden) schedule();
  };
  function schedule() { if (!raf && !document.hidden) raf = requestAnimationFrame(tick); }
  const visibility = () => { previous = 0; if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else schedule(); };
  const observer = new ResizeObserver(measure);
  document.querySelectorAll(".zoom-scene").forEach(section => observer.observe(section));
  window.addEventListener("resize", measure);
  window.addEventListener("scroll", schedule, { passive: true });
  preference.addEventListener("change", measure);
  document.addEventListener("visibilitychange", visibility);
  measure();
  return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("scroll", schedule); preference.removeEventListener("change", measure); document.removeEventListener("visibilitychange", visibility); };
}
