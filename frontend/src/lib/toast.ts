"use client";
import { create } from "zustand";
import { toast as sonnerToast } from "sonner";

// ── Types ──────────────────────────────────────
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[]; // Mantido para retrocompatibilidade, mas não usado
  add: (toast: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

export const useToastStore = create<ToastState>(() => ({
  toasts: [],
  
  add: (toast) => {
    // Adapter para Sonner
    if (toast.type === "success") sonnerToast.success(toast.title, { description: toast.message });
    else if (toast.type === "error") sonnerToast.error(toast.title, { description: toast.message });
    else if (toast.type === "warning") sonnerToast.warning(toast.title, { description: toast.message });
    else sonnerToast.info(toast.title, { description: toast.message });
  },

  remove: (id) => sonnerToast.dismiss(id),

  success: (title, message) => sonnerToast.success(title, { description: message }),
  error: (title, message) => sonnerToast.error(title, { description: message, duration: 6000 }),
  warning: (title, message) => sonnerToast.warning(title, { description: message }),
  info: (title, message) => sonnerToast.info(title, { description: message }),
}));
