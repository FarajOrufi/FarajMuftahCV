"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createTunnelAudio, type AudioTelemetry } from "./tunnel-audio";

const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function SoundControl({ arabic }: { arabic: boolean }) {
  const [state, setState] = useState<"off" | "loading" | "on" | "error">("off");
  const ready = useSyncExternalStore(subscribeReady, clientReady, serverReady);
  const engine = useRef<ReturnType<typeof createTunnelAudio> | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; engine.current?.dispose(); engine.current = null; };
  }, []);
  const report = (value: AudioTelemetry) => {
    if (button.current) button.current.dataset.audio = JSON.stringify(value);
  };
  const toggle = async () => {
    if (busy.current) return;
    if (state === "on") { engine.current?.disable(); setState("off"); return; }
    busy.current = true; setState("loading");
    try {
      engine.current ??= createTunnelAudio(report, () => { if (alive.current) setState("error"); }, value => {
        if (button.current) button.current.dataset.audioMotion = JSON.stringify(value);
      });
      await engine.current.enable();
      if (alive.current) setState("on");
    } catch {
      engine.current?.dispose(); engine.current = null;
      if (alive.current) setState("error");
    } finally { busy.current = false; }
  };
  const label = arabic
    ? state === "on" ? "كتم الصوت" : state === "loading" ? "جارٍ تجهيز الصوت" : state === "error" ? "تعذّر تشغيل الصوت، أعد المحاولة" : "تشغيل الصوت"
    : state === "on" ? "Mute sound" : state === "loading" ? "Loading sound" : state === "error" ? "Sound unavailable, retry" : "Enable sound";
  const text = arabic
    ? state === "on" ? "الصوت يعمل" : state === "loading" ? "جارٍ التجهيز" : state === "error" ? "أعد المحاولة" : "الصوت مغلق"
    : state === "on" ? "Sound on" : state === "loading" ? "Loading" : state === "error" ? "Retry sound" : "Sound off";
  return <div className="sound-control" dir={arabic ? "rtl" : "ltr"}>
    <button ref={button} className="sound-toggle" type="button" aria-label={label} aria-pressed={state === "on"}
      aria-busy={state === "loading"} disabled={!ready || state === "loading"} onClick={toggle} title={label}>
      <svg className="sound-wave" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 14v4m5-10v16m6-20v24m6-18v12m5-8v4" /></svg>
      <span>{text}</span>
    </button>
    <span className="sound-status" role="status">{state === "error" ? label : ""}</span>
  </div>;
}
