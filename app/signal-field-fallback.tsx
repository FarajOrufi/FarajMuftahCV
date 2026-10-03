"use client";

import { useEffect, useRef } from "react";
import { clamp01, sceneTravelAt } from "./scene-motion";

type Particle = { angle: number; radius: number; z: number; size: number; pale: boolean };
type Circuit = { angle: number; bendA: number; bendB: number; weight: number; phase: number; bright: boolean };
type Ring = { phase: number; squash: number; weight: number; arc: number; rotation: number };

const TAU = Math.PI * 2;
const fract = (value: number) => value - Math.floor(value);
const bell = (value: number) => Math.sin(Math.PI * clamp01(value));

/** Scroll-synchronised perspective field: particles, circuit paths and luminous gates. */
export default function SignalFieldFallback() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let last = 0;
    let clock = 0;
    let camera = 0;
    let cameraTarget = 0;
    let pointerX = 0;
    let pointerY = 0;
    let pointerTargetX = 0;
    let pointerTargetY = 0;
    let seed = 8317;

    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const particles: Particle[] = Array.from({ length: 1450 }, () => ({
      angle: random() * TAU,
      radius: 0.42 + random() * 0.82,
      z: random(),
      size: 0.35 + random() * 1.55,
      pale: random() > 0.87,
    }));

    const circuits: Circuit[] = Array.from({ length: 52 }, (_, index) => ({
      angle: (index / 52) * TAU + (random() - 0.5) * 0.12,
      bendA: (random() - 0.5) * 0.24,
      bendB: (random() - 0.5) * 0.34,
      weight: 0.45 + random() * 1.15,
      phase: random(),
      bright: index % 7 === 0,
    }));

    const rings: Ring[] = Array.from({ length: 15 }, (_, index) => ({
      phase: index / 15,
      squash: 0.86 + (random() - 0.5) * 0.055,
      weight: index % 5 === 0 ? 1.8 : 0.62 + random() * 0.52,
      arc: index % 4 === 0 ? TAU : 0.72 + random() * 1.55,
      rotation: random() * TAU,
    }));

    // Generate fine dust after the original geometry to preserve its seeded layout.
    for (let index = particles.length; index < 5400; index++) {
      particles.push({
        angle: random() * TAU,
        radius: 0.42 + random() * 0.82,
        z: random(),
        size: 0.32 + Math.pow(random(), 1.7) * 1.1,
        pale: random() > 0.9,
      });
    }
    // Reuse alpha buckets: thousands of stars need only twenty canvas fills.
    const alphaLevels = 10;
    const starBatches = Array.from({ length: alphaLevels * 2 }, () => [] as number[]);

    const resize = () => {
      width = document.documentElement.clientWidth;
      height = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const readScene = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>(".zoom-scene"));
      if (!sections.length) return window.scrollY / Math.max(height, 1);

      const pinned = sections.findIndex((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= 1 && rect.bottom >= height - 1;
      });
      const activeIndex = pinned >= 0
        ? pinned
        : sections.reduce((closest, section, index) => {
          const currentDistance = Math.abs(section.getBoundingClientRect().top);
          const closestDistance = Math.abs(sections[closest].getBoundingClientRect().top);
          return currentDistance < closestDistance ? index : closest;
        }, 0);
      const rect = sections[activeIndex].getBoundingClientRect();
      const section = sections[activeIndex];
      return activeIndex + sceneTravelAt(-rect.top, Math.max(1, rect.height - height), Number(section.dataset.approach ?? 0) * height);
    };

    const updateTarget = () => {
      cameraTarget = readScene();
    };

    const pointer = (event: PointerEvent) => {
      pointerTargetX = (event.clientX / Math.max(width, 1) - 0.5) * 24;
      pointerTargetY = (event.clientY / Math.max(height, 1) - 0.5) * 18;
    };

    const pointOnTunnel = (cx: number, cy: number, radius: number, angle: number, squash: number) => ({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * squash,
    });

    const draw = (stamp: number) => {
      frame = 0;
      const dt = last === 0 ? 0 : Math.min((stamp - last) / 1000, 0.05);
      last = stamp;
      if (!reduced.matches) clock += dt;
      camera += (cameraTarget - camera) * (reduced.matches ? 1 : 0.085);
      pointerX += (pointerTargetX - pointerX) * 0.045;
      pointerY += (pointerTargetY - pointerY) * 0.045;

      ctx.clearRect(0, 0, width, height);
      const autonomous = reduced.matches ? 0 : clock * 0.008;
      const depth = camera + autonomous;
      const cx = width * (0.5 + Math.sin(depth * 1.17) * 0.026) + (reduced.matches ? 0 : pointerX);
      const cy = height * (0.5 + Math.cos(depth * 0.83) * 0.017) + (reduced.matches ? 0 : pointerY);
      const minSide = Math.min(width, height);
      const core = minSide * 0.046;
      const outer = Math.hypot(width, height) * 0.79;
      const rotation = depth * 0.012;

      const atmosphere = ctx.createRadialGradient(cx, cy, core * 0.25, cx, cy, outer);
      atmosphere.addColorStop(0, "rgba(0,2,11,.88)");
      atmosphere.addColorStop(0.18, "rgba(8,18,72,.34)");
      atmosphere.addColorStop(0.48, "rgba(22,48,143,.17)");
      atmosphere.addColorStop(0.78, "rgba(8,22,82,.12)");
      atmosphere.addColorStop(1, "rgba(1,3,15,0)");
      ctx.fillStyle = atmosphere;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const circuit of circuits) {
        const base = circuit.angle + rotation;
        const radii = [core * 0.72, outer * (0.15 + circuit.phase * 0.05), outer * 0.39, outer * (0.61 + circuit.phase * 0.1), outer * 1.08];
        const angles = [base, base, base + circuit.bendA, base + circuit.bendA, base + circuit.bendA + circuit.bendB];
        ctx.strokeStyle = circuit.bright ? "rgba(73,116,255,.34)" : "rgba(43,78,198,.22)";
        ctx.lineWidth = circuit.weight;
        ctx.beginPath();
        radii.forEach((radius, index) => {
          const point = pointOnTunnel(cx, cy, radius, angles[index], 0.87);
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();

        const beadZ = fract(circuit.phase + depth * 0.19);
        const beadRadius = core + beadZ * beadZ * outer * 0.96;
        const beadAngle = base + (beadZ > 0.42 ? circuit.bendA : 0) + (beadZ > 0.7 ? circuit.bendB : 0);
        const bead = pointOnTunnel(cx, cy, beadRadius, beadAngle, 0.87);
        const beadFade = Math.pow(bell(beadZ), 0.7) * (circuit.bright ? 0.8 : 0.42);
        ctx.fillStyle = `rgba(76,119,247,${beadFade})`;
        ctx.shadowColor = "rgba(73,113,255,.75)";
        ctx.shadowBlur = circuit.bright ? 12 : 0;
        ctx.beginPath();
        ctx.arc(bead.x, bead.y, 0.8 + beadZ * beadZ * (circuit.bright ? 5.2 : 2.8), 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      for (const ring of rings) {
        const z = fract(ring.phase + depth * 0.165);
        const radius = core + Math.pow(z, 2.18) * outer;
        const fade = Math.pow(bell(z), 0.62);
        if (fade < 0.025) continue;
        const alpha = fade * (ring.weight > 1.5 ? 0.46 : 0.18);
        ctx.strokeStyle = `rgba(104,145,255,${alpha})`;
        ctx.lineWidth = ring.weight + z * (ring.weight > 1.5 ? 1.8 : 0.45);
        ctx.shadowColor = "rgba(91,132,255,.92)";
        ctx.shadowBlur = ring.weight > 1.5 ? 11 + z * 6 : 0;
        const start = ring.rotation + rotation * 1.7;
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius, radius * ring.squash, rotation * 0.3, start, start + ring.arc);
        ctx.stroke();
        if (ring.arc < TAU) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius, radius * ring.squash, rotation * 0.3, start + Math.PI, start + Math.PI + ring.arc * 0.64);
          ctx.stroke();
        }
      }
      ctx.shadowBlur = 0;

      const particleCount = width < 720 ? 2400 : particles.length;
      const idleTime = reduced.matches ? 0 : clock;
      for (const batch of starBatches) batch.length = 0;
      for (let index = 0; index < particleCount; index++) {
        const particle = particles[width < 720 ? index * 2 : index];
        // Scroll keeps the shared camera; idle drift adds slow, varied depth motion.
        const z = fract(particle.z + camera * 0.205 + idleTime * (0.0026 + particle.radius * 0.0018));
        const radius = core * 0.25 + Math.pow(z, 2.05) * outer * particle.radius;
        const angle = particle.angle + rotation * (0.45 + particle.radius * 0.2)
          + idleTime * 0.0008 * (0.6 + particle.radius);
        const point = pointOnTunnel(cx, cy, radius, angle, 0.87);
        if (point.x < -8 || point.x > width + 8 || point.y < -8 || point.y > height + 8) continue;
        const shimmer = reduced.matches ? 1 : 0.93 + Math.sin(idleTime * 0.55 + particle.angle * 3) * 0.07;
        const alpha = Math.pow(bell(z), 0.54) * (particle.pale ? 0.7 : 0.55) * shimmer;
        if (alpha < 0.035) continue;
        const size = Math.min(3.2, particle.size * (0.32 + z * z * 1.9));
        const alphaBand = Math.min(alphaLevels - 1, Math.floor(alpha * alphaLevels));
        starBatches[(particle.pale ? alphaLevels : 0) + alphaBand].push(point.x, point.y, size);
      }
      for (let index = 0; index < starBatches.length; index++) {
        const batch = starBatches[index];
        if (!batch.length) continue;
        ctx.fillStyle = index >= alphaLevels ? "rgb(193,210,255)" : "rgb(53,99,235)";
        ctx.globalAlpha = ((index % alphaLevels) + 0.5) / alphaLevels;
        ctx.beginPath();
        for (let point = 0; point < batch.length; point += 3) {
          const x = batch[point], y = batch[point + 1], size = batch[point + 2];
          ctx.moveTo(x + size, y);
          ctx.arc(x, y, size, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const horizon = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 2.5);
      horizon.addColorStop(0, "rgba(0,1,7,.98)");
      horizon.addColorStop(0.56, "rgba(2,5,20,.94)");
      horizon.addColorStop(0.78, "rgba(47,84,218,.18)");
      horizon.addColorStop(1, "rgba(55,92,230,0)");
      ctx.fillStyle = horizon;
      ctx.beginPath();
      ctx.arc(cx, cy, core * 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();

      if (!reduced.matches && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const restart = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      updateTarget();
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    const onResize = () => { resize(); restart(); };
    const onScroll = () => {
      updateTarget();
      if (reduced.matches) restart();
    };

    resize();
    updateTarget();
    restart();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("visibilitychange", restart);
    reduced.addEventListener("change", restart);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", pointer);
      document.removeEventListener("visibilitychange", restart);
      reduced.removeEventListener("change", restart);
    };
  }, []);

  return <canvas ref={canvasRef} className="signal-field" aria-hidden="true" />;
}
