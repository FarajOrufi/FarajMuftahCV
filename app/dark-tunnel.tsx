"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { clamp01, smoothstep } from "./scene-motion";
import { subscribeMotion } from "./motion-clock";

const rings = Array.from({ length: 7 }, (_, index) => index);

export default function DarkTunnel() {
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = root.current;
    const tunnel = stage.current;
    if (!section || !tunnel) return;
    return subscribeMotion(frame => {
      if (frame.reduced || frame.height <= 600) {
        tunnel.style.setProperty("--tunnel-progress", "0");
        tunnel.style.setProperty("--tunnel-black", "0");
        return;
      }
      const top = section.offsetTop - frame.scroll;
      const progress = clamp01(-top / Math.max(1, section.offsetHeight - frame.height));
      const enter = smoothstep(progress / .22);
      const exit = smoothstep((progress - .72) / .28);
      const black = enter * (1 - exit);
      tunnel.style.setProperty("--tunnel-progress", progress.toFixed(4));
      tunnel.style.setProperty("--tunnel-black", black.toFixed(4));
      tunnel.style.setProperty("--tunnel-portal", (0.22 + progress * 5.2).toFixed(4));
      tunnel.style.setProperty("--tunnel-light", (exit * .8).toFixed(4));
    });
  }, []);

  return <section ref={root} className="zoom-scene dark-tunnel-scene" aria-label="Dark transition tunnel">
    <div ref={stage} className="zoom-stage dark-tunnel-stage">
      <div className="tunnel-portal" aria-hidden="true">
        {rings.map(index => <span key={index} style={{ "--ring": index } as CSSProperties} />)}
        <i />
      </div>
      <div className="tunnel-veil" aria-hidden="true" />
      <div className="tunnel-exit-light" aria-hidden="true" />
    </div>
  </section>;
}
