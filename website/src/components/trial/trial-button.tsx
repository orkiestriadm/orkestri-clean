"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useTrialModal } from "@/lib/trial-modal";

/**
 * CTA que abre o modal de teste rápido em vez de navegar. Substitui os
 * `<Button asChild><Link href="/demo">…` espalhados pela LD, mantendo o mesmo
 * visual (variant/size/className passam direto para o Button).
 */
export function TrialButton({ children, onClick, ...props }: ButtonProps) {
  const abrir = useTrialModal((s) => s.abrir);
  return (
    <Button
      type="button"
      onClick={(e) => { onClick?.(e); abrir(); }}
      {...props}
    >
      {children}
    </Button>
  );
}
