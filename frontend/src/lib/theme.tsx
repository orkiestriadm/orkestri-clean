"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "dark", toggle: () => {} });

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("orkestri-theme-v2") as Theme | null;
  if (saved === "dark" || saved === "light") return saved;
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const t = getPreferredTheme();
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    const html = document.documentElement;
    html.classList.add("theme-transitioning");
    setTheme(next);
    localStorage.setItem("orkestri-theme-v2", next);
    html.setAttribute("data-theme", next);
    setTimeout(() => html.classList.remove("theme-transitioning"), 300);
  };

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
