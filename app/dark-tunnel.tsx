"use client";

import { useEffect, useRef } from "react";
import { subscribeMotion } from "./motion-clock";

export default function DarkTunnel() {
  const veil = useRef<HTMLDivElement>(null);
  const fallback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = veil.current;
    const disk = fallback.current;
    if (!overlay || !disk) return;
    return subscribeMotion(frame => {
      const { cover, exit, approaching, index } = frame.dark;
      const visible = cover > 0 && exit < 1;
      overlay.style.visibility = visible ? "visible" : "hidden";
      overlay.style.opacity = String(cover);
      // Opening a circular aperture reveals the existing tube, without a panel.
      const radius = Math.hypot(frame.width, frame.height) * .51 * exit;
      overlay.style.maskImage = exit > 0
        ? `radial-gradient(circle at 50% 50%, transparent ${radius}px, #000 ${radius + 1}px)`
        : "none";
      overlay.dataset.cover = cover.toFixed(4);
      overlay.dataset.exit = exit.toFixed(4);
      overlay.dataset.travel = frame.travel.toFixed(4);
      const gap = Math.max(.1, (index - frame.travel) * 30);
      const size = frame.height * 5 / (Math.tan(Math.PI / 6) * gap);
      disk.style.visibility = approaching ? "visible" : "hidden";
      disk.style.transform = `translate(-50%, -50%) scale(${size})`;
    });
  }, []);

  return <>
    <section id="dark-crossing" className="zoom-scene dark-tunnel-scene" aria-hidden="true" />
    <div ref={fallback} className="dark-portal-fallback" aria-hidden="true" />
    <div ref={veil} className="dark-tunnel-veil" aria-hidden="true" />
  </>;
}
