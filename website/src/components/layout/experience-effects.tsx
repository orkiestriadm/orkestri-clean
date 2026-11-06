"use client";

import { useEffect } from "react";

/** Realce local de superfícies e registro global do PWA (/sw.js) no site. */
export function ExperienceEffects() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as unknown as { __orkiestriDeferredPwaPrompt?: Event }).__orkiestriDeferredPwaPrompt = e;
      window.dispatchEvent(new Event("orkiestri:pwa-ready"));
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if (
      !window.matchMedia(
        "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
      ).matches
    ) {
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      };
    }
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
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);
  return <div className="reading-progress" aria-hidden />;
}
