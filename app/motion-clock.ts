import { clamp01, sceneTravel } from "./scene-motion";

export type MotionFrame = { scroll: number; width: number; height: number; time: number; dt: number; reduced: boolean; travel: number; velocity: number };
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
  let layout: { top: number; span: number }[] = [];
  const measure = () => {
    layout = [...document.querySelectorAll<HTMLElement>(".zoom-scene")].map(section => ({
      top: section.getBoundingClientRect().top + window.scrollY,
      span: Math.max(1, section.offsetHeight - innerHeight),
    }));
    schedule();
  };
  const tick = (now: number) => {
    raf = 0;
    const dt = previous ? Math.min((now - previous) / 1000, .05) : 1 / 60;
    previous = now;
    if (!preference.matches) time += dt;
    scroll += (window.scrollY - scroll) * (preference.matches ? 1 : 1 - Math.exp(-14 * dt));
    if (Math.abs(scroll - window.scrollY) < .02) scroll = window.scrollY;
    let index = 0;
    for (let i = 0; i < layout.length; i++) if (scroll >= layout[i].top) index = i;
    const active = layout[index];
    const travel = active ? index + sceneTravel(clamp01((scroll - active.top) / active.span)) : 0;
    const state = { scroll, width: innerWidth, height: innerHeight, time, dt, reduced: preference.matches, travel, velocity: (travel - previousTravel) / dt };
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
