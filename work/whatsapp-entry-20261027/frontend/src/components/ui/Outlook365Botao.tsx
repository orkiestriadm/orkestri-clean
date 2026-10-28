"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "@/components/data-ui";
import IntegracoesConfig from "./IntegracoesConfig";

/**
 * Porta de entrada da integração com o Outlook dentro do Space (Agenda).
 * O rótulo acompanha a situação da pessoa; o clique abre a mesma tela de
 * Integrações em modo usuário (solicitar, conectar, sincronizar). Some
 * enquanto o administrador não tiver configurado o aplicativo no Entra.
 */

type Situacao = { configured: boolean; connected: boolean; status: string; acesso?: string };

const OutlookIcone = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
  </svg>
);

export default function Outlook365Botao() {
  const [sit, setSit] = useState<Situacao | null>(null);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get<Situacao>("/integracoes/microsoft/status");
      setSit(data);
    } catch { setSit(null); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  // O aviso de "integração liberada" aponta para a Agenda com ?outlook=1.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("outlook") === "1") {
      setAberto(true);
      params.delete("outlook");
      const qs = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  if (!sit?.configured) return null;

  const conectado = sit.connected && sit.status !== "DISCONNECTED";
  const acesso = sit.acesso || "nenhum";
  const rotulo = conectado
    ? sit.status === "REAUTH_REQUIRED" ? "Outlook: reconectar" : "Outlook conectado"
    : acesso === "liberado" ? "Conectar Outlook"
    : acesso === "pendente" ? "Outlook: aguardando liberação"
    : "Integrar com Outlook";
  const ponto = conectado && sit.status !== "REAUTH_REQUIRED"
    ? "var(--accent-green)"
    : acesso === "pendente" || sit.status === "REAUTH_REQUIRED" ? "var(--accent-amber, #f59e0b)"
    : acesso === "liberado" ? "var(--accent-cyan)"
    : null;

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost no-print"
        style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
        onClick={() => setAberto(true)}
        aria-label={rotulo}
        title="Integração da agenda com o Outlook (Microsoft 365)"
      >
        <OutlookIcone />
        {rotulo}
        {ponto && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: "50%", background: ponto }} />}
      </button>
      <Modal aberto={aberto} onFechar={() => { setAberto(false); carregar(); }} titulo="Integração com o Outlook" largura={640}>
        <IntegracoesConfig modo="usuario" />
      </Modal>
    </>
  );
}
