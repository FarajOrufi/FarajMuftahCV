"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { clamp01, smoothstep } from "./scene-motion";
import { subscribeMotion } from "./motion-clock";

export default function ZoomScene({ children, id, first = false, last = false, label, signals }: {
  children: ReactNode; id: string; first?: boolean; last?: boolean; label: string; signals?: readonly string[];
}) {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const signalField = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const section = root.current, content = panel.current;
    if (!section || !content) return;
    return subscribeMotion(frame => {
      if (frame.reduced || frame.height <= 600) { content.style.transform = "none"; content.style.opacity = "1"; content.style.filter = "none"; content.style.willChange = "auto"; content.inert = false; if (signalField.current) signalField.current.style.opacity = "0"; return; }
      const top = section.offsetTop - frame.scroll;
      const p = clamp01(-top / Math.max(1, section.offsetHeight - frame.height));
      const enter = first ? 1 : smoothstep(p / .28);
      const leave = last ? 0 : smoothstep((p - .66) / .34);
      const scale = .58 + enter * .42 + leave * .85;
      const opacity = enter * (1 - leave);
      content.style.transform = `perspective(1000px) translate3d(0,${(1-enter)*28-leave*18}px,0) scale(${scale})`;
      content.style.opacity = String(opacity);
      content.style.filter = `blur(${((1-enter)*5+leave*7).toFixed(2)}px)`;
      content.inert = opacity < .1;
      content.style.willChange = top < frame.height && top + section.offsetHeight > 0 ? "transform, opacity, filter" : "auto";
      if (signalField.current) {
        const field = signalField.current;
        const flicker = Math.max(0, Math.min(1, (p - .13) / .12, (.72 - p) / .14));
        field.style.opacity = String(flicker * .56);
        field.style.transform = `translate3d(0,${(p - .35) * -24}px,0)`;
      }
    });
  }, [first,last]);
  return <section ref={root} id={id} data-first={first || undefined} data-last={last || undefined} className={`zoom-scene${first ? " zoom-first" : ""}${last ? " zoom-last" : ""}`} aria-label={label}>
    <div className="zoom-stage">
      {signals?.length ? <div ref={signalField} className="scene-signals" aria-hidden="true">
        {signals.map((word, index) => <span key={word} className={`scene-signal scene-signal-${index + 1}`}>{word}</span>)}
      </div> : null}
      <div ref={panel} className="zoom-panel">{children}</div>
    </div>
  </section>;
}
