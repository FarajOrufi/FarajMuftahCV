"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { clamp01, smoothstep } from "./scene-motion";
import { subscribeMotion } from "./motion-clock";

const signalStarts = [0.14, 0.31, 0.48, 0.65] as const;
const signalDuration = 0.28;

export default function ZoomScene({ children, id, first = false, last = false, label, signals, approach = 0 }: {
  children: ReactNode; id: string; first?: boolean; last?: boolean; label: string; signals?: readonly string[]; approach?: number;
}) {
  const root = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const signalField = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const section = root.current, content = panel.current;
    if (!section || !content) return;
    return subscribeMotion(frame => {
      if (frame.reduced || frame.height <= 600) {
        content.style.transform = "none"; content.style.opacity = "1"; content.style.filter = "none"; content.style.willChange = "auto"; content.inert = false;
        if (signalField.current) {
          signalField.current.style.opacity = "1";
          signalField.current.style.transform = "none";
          Array.from(signalField.current.children).forEach(child => {
            if (!(child instanceof HTMLElement)) return;
            child.style.opacity = "1";
            child.style.transform = "none";
          });
        }
        return;
      }
      const top = section.offsetTop - frame.scroll;
      // Text finishes on its original beat; the extra scroll is camera-only.
      const p = clamp01(-top / Math.max(1, section.offsetHeight - frame.height * (1 + approach)));
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
        const envelope = smoothstep((p - .10) / .06) * (1 - smoothstep((p - .84) / .10));
        field.style.opacity = String(envelope * .88);
        field.style.transform = `translate3d(0,${(p - .35) * -24}px,0)`;
        Array.from(field.children).forEach((child, index) => {
          if (!(child instanceof HTMLElement)) return;
          const local = clamp01((p - signalStarts[index]) / signalDuration);
          const enter = smoothstep(local / .18);
          const leave = smoothstep((local - .72) / .28);
          const path = smoothstep(local);
          const fromX = index % 2 === 0 ? -18 : 18;
          const toX = index % 2 === 0 ? 14 : -14;
          const fromY = index < 2 ? -12 : 12;
          const toY = index < 2 ? 10 : -10;
          const x = fromX + (toX - fromX) * path;
          const y = fromY + (toY - fromY) * path;
          child.style.opacity = String(enter * (1 - leave));
          child.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(.97 + enter * .03).toFixed(3)})`;
        });
      }
    });
  }, [first,last,approach]);
  return <section ref={root} id={id} data-first={first || undefined} data-last={last || undefined} data-approach={approach || undefined}
    className={`zoom-scene${first ? " zoom-first" : ""}${last ? " zoom-last" : ""}${approach ? " zoom-approach" : ""}`}
    style={approach ? { "--approach-height": `${approach * 100}svh` } as CSSProperties : undefined} aria-label={label}>
    <div className="zoom-stage">
      {signals?.length ? <div ref={signalField} className="scene-signals" aria-hidden="true">
        {signals.map((word, index) => <span key={word} className={`scene-signal scene-signal-${index + 1}`}>{word}</span>)}
      </div> : null}
      <div ref={panel} className="zoom-panel">{children}</div>
    </div>
  </section>;
}
