"use client";
import Topbar from "@/components/layout/Topbar";
import IntegracoesConfig from "@/components/ui/IntegracoesConfig";

/**
 * Rota dedicada de Integrações (destino do redirect do OAuth da Microsoft).
 * Reaproveita o mesmo componente exibido na aba de Configurações.
 */
export default function IntegracoesPage() {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <IntegracoesConfig />
      </div>
    </div>
  );
}
