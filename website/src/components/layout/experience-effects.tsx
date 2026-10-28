"use client";

import { useEffect } from "react";

/** Realce local de superfícies; não acompanha o usuário, não envia telemetria. */
export function ExperienceEffects() {
  useEffect(() => {
    if (
      !window.matchMedia(
        "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      ).matches
    )
      return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      const surface =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-spotlight]")
          : null;
      if (!surface) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
        surface.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
      });
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
    };
  }, []);
  return <div className="reading-progress" aria-hidden />;
}
