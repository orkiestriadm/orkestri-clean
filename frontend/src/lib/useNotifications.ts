"use client";
import { useEffect, useRef } from "react";
import { useAuthStore } from "./store";

export function useNotifications() {
  const { token } = useAuthStore();
  const swRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !token) return;

    const setup = async () => {
      // Pede permissao
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }

      if (!("serviceWorker" in navigator)) return;

      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        const sw = reg.active || reg.installing || reg.waiting;
        if (sw) {
          swRef.current = sw;
          sw.postMessage({
            type: "SET_TOKEN",
            token,
            apiUrl: window.location.origin + "/api",
          });
        }

        // Tambem checa via polling no browser para alertas visuais
        const checkInterval = setInterval(async () => {
          if (reg.active) {
            reg.active.postMessage({ type: "CHECK_NOW" });
          }
        }, 60000);

        return () => clearInterval(checkInterval);
      } catch (e) {
        console.warn("Service Worker nao disponivel:", e);
      }
    };

    setup();
  }, [token]);
}