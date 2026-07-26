import type { Easing } from "framer-motion";

/**
 * Shared motion tokens (doc 08 — Motion System).
 * Durations in seconds; easing as typed cubic-bezier tuples.
 */
export const EASE_OUT: Easing = [0.25, 1, 0.5, 1];
export const EASE_IN_OUT: Easing = [0.76, 0, 0.24, 1];

export const DURATION = {
  micro: 0.12,
  hover: 0.18,
  enter: 0.25,
  modal: 0.28,
  drawer: 0.3,
  page: 0.35,
} as const;
