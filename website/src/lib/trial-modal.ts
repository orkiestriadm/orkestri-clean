import { create } from "zustand";

/**
 * Estado do modal de teste rápido. Os CTAs "Solicitar demonstração" espalhados
 * pela LD chamam `abrir()`; o `<TrialModal>` (montado no layout) lê `aberto`.
 */
interface TrialModalState {
  aberto: boolean;
  abrir: () => void;
  fechar: () => void;
}

export const useTrialModal = create<TrialModalState>((set) => ({
  aberto: false,
  abrir: () => set({ aberto: true }),
  fechar: () => set({ aberto: false }),
}));
