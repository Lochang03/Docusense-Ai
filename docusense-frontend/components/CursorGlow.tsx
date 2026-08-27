"use client";

import { useEffect, useRef } from "react";

export function CursorGlow({ variant = "hero" }: { variant?: "hero" | "workspace" }) {
  const target = useRef({ x: 0.5, y: 0.35 });
  const current = useRef({ x: 0.5, y: 0.35 });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    function handlePointerMove(e: PointerEvent) {
      target.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    }
    window.addEventListener("pointermove", handlePointerMove);

    let raf: number;
    function tick() {
      current.current.x += (target.current.x - current.current.x) * 0.08;
      current.current.y += (target.current.y - current.current.y) * 0.08;
      document.documentElement.style.setProperty("--glow-x", `${current.current.x * 100}%`);
      document.documentElement.style.setProperty("--glow-y", `${current.current.y * 100}%`);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const isWorkspace = variant === "workspace";

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 ${isWorkspace ? "z-30" : "z-0"} opacity-0 transition-opacity duration-700 motion-safe:opacity-100`}
      style={{
        background: isWorkspace
          ? "radial-gradient(200px circle at var(--glow-x, 50%) var(--glow-y, 35%), rgba(212,180,131,0.62), transparent 60%), " +
            "radial-gradient(500px circle at var(--glow-x, 50%) var(--glow-y, 35%), rgba(212,180,131,0.28), transparent 70%)"
          : "radial-gradient(220px circle at var(--glow-x, 50%) var(--glow-y, 35%), rgba(176,141,87,0.35), transparent 60%), " +
            "radial-gradient(620px circle at var(--glow-x, 50%) var(--glow-y, 35%), rgba(176,141,87,0.16), transparent 70%)",
        mixBlendMode: isWorkspace ? "screen" : "normal",
      }}
    />
  );
}