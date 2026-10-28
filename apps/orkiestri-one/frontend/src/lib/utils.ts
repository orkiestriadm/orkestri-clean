import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitário padrão do Shadcn UI para mesclar classes Tailwind condicionalmente
 * resolvendo conflitos através do tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
