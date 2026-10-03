"use client";

import { useEffect, useRef, useState } from "react";
import SignalFieldFallback from "./signal-field-fallback";

export default function SignalField() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const lost = (event: Event) => { event.preventDefault(); dispose?.(); dispose = undefined; setFallback(true); };
    element.addEventListener("webglcontextlost", lost);
    // The renderer is not part of the initial content bundle.
    import("./tunnel-engine").then(({ createTunnel }) => {
      if (!cancelled) dispose = createTunnel(element);
    }).catch(() => { if (!cancelled) setFallback(true); });
    return () => { cancelled = true; element.removeEventListener("webglcontextlost", lost); dispose?.(); };
  }, []);
  return fallback ? <SignalFieldFallback /> : <canvas ref={canvas} className="signal-field signal-field-3d" aria-hidden="true" />;
}
