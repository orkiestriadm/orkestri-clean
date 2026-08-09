"use client";
export const dynamic = "force-dynamic";

/**
 * Configuração do WhatsApp.
 *
 * Reescrita para usar as primitivas do design system (`PageHeader`, `Panel`).
 * Antes eram dois cartões soltos com estilo inline próprio, num container de
 * 560px encostado à esquerda — destoava de todas as outras telas do sistema e
 * desperdiçava a largura disponível.
 *
 * A organização da página segue a ordem em que o master de fato trabalha:
 * conectar o aparelho → decidir quem recebe → configurar o próprio número.
 */

import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import WhatsAppUserConfig from "@/components/ui/WhatsAppUserConfig";
import PermissoesMensagemModal from "@/components/notificacoes/PermissoesMensagemModal";
import { PageBody, PageHeader, Panel } from "@/components/data-ui";
import { ShieldCheck, MessageCircle, RefreshCw, QrCode, Plug, Unplug } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

function Spin() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

/** Etiqueta de estado da conexão — mesma linguagem visual do farol de frota. */
function EstadoConexao({ conectado, detalhe }: { conectado: boolean; detalhe?: string }) {
  const cor = conectado ? "var(--accent-green)" : "var(--accent-red)";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12,
      background: `color-mix(in srgb, ${cor} 7%, transparent)`,
      border: `1px solid color-mix(in srgb, ${cor} 22%, transparent)`,
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%", background: cor,
        boxShadow: `0 0 10px ${cor}`, flexShrink: 0,
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: cor }}>
          {conectado ? "Conectado" : "Desconectado"}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
          {conectado
            ? "As mensagens saem normalmente."
            : "As mensagens ficam na fila e são entregues quando a conexão voltar."}
          {detalhe && <> · <span style={{ fontFamily: "var(--font-mono)" }}>{detalhe}</span></>}
        </div>
      </div>
    </div>
  );
}

function OrgWhatsAppPanel() {
  const [status, setStatus] = useState<{ connected: boolean; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/organizations/me/whatsapp/status");
      setStatus(r.data);
    } catch { /* a tela continua útil com o último estado conhecido */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refreshStatus(); }, []);

  const aviso = (text: string, ok: boolean, ms = 5000) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), ms);
  };

  const createInstance = async () => {
    setLoading(true);
    try {
      await api.post("/organizations/me/whatsapp/create-instance");
      aviso("Instância criada. Aguarde e clique em Ver QR Code.", true);
      await refreshStatus();
    } catch { aviso("Erro ao criar instância.", false); }
    finally { setLoading(false); }
  };

  const getQrCode = async () => {
    setQrLoading(true); setQr(null);
    try {
      const r = await api.get("/organizations/me/whatsapp/qrcode");
      const raw = r.data?.base64 || r.data?.qrcode?.base64 || r.data?.code;
      if (raw) setQr(raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`);
      else aviso("QR Code indisponível. Tente novamente.", false);
    } catch { aviso("Erro ao buscar QR Code.", false); }
    finally { setQrLoading(false); }
  };

  const disconnect = async () => {
    if (!confirm("Desconectar o WhatsApp da organização? Nenhuma mensagem sai até parear de novo.")) return;
    setLoading(true);
    try {
      await api.post("/organizations/me/whatsapp/disconnect");
      setQr(null);
      await refreshStatus();
      aviso("WhatsApp desconectado.", true, 4000);
    } catch { aviso("Erro ao desconectar.", false); }
    finally { setLoading(false); }
  };

  const conectado = !!status?.connected;

  return (
    <Panel
      title="Conexão da organização"
      actions={
        <button className="btn btn-ghost" style={{ fontSize: 11, gap: 6 }} onClick={refreshStatus} title="Atualizar status">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {msg && (
          <div style={{
            padding: "10px 14px", borderRadius: 10, fontSize: 12.5,
            background: msg.ok ? "color-mix(in srgb, var(--accent-green) 8%, transparent)"
                               : "color-mix(in srgb, var(--accent-red) 8%, transparent)",
            border: `1px solid color-mix(in srgb, ${msg.ok ? "var(--accent-green)" : "var(--accent-red)"} 25%, transparent)`,
            color: msg.ok ? "var(--accent-green)" : "var(--accent-red)",
          }}>
            {msg.text}
          </div>
        )}

        {loading && !status ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12.5, padding: 8 }}>
            <Spin /> Verificando status…
          </div>
        ) : (
          <>
            <EstadoConexao conectado={conectado} detalhe={status?.status} />

            {qr && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                padding: 18, background: "var(--bg-secondary)", borderRadius: 12,
                border: "1px solid var(--border-subtle)",
              }}>
                <div style={{ fontSize: 12.5, color: "var(--text-secondary)", textAlign: "center" }}>
                  Escaneie com o WhatsApp da empresa
                </div>
                {/* Fundo branco fixo: em tema escuro o QR fica ilegível sem ele. */}
                <img src={qr} alt="QR Code de pareamento"
                     style={{ width: 210, height: 210, borderRadius: 10, background: "#fff", padding: 8 }} />
                <button className="btn btn-ghost" style={{ fontSize: 11, gap: 6 }} onClick={getQrCode} disabled={qrLoading}>
                  <RefreshCw size={12} /> Gerar novo código
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {!conectado && (
                <>
                  <button className="btn btn-violet" style={{ fontSize: 12, gap: 6 }} onClick={createInstance}>
                    <Plug size={13} /> Criar instância
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }} onClick={getQrCode} disabled={qrLoading}>
                    {qrLoading ? <Spin /> : <QrCode size={13} />} Ver QR Code
                  </button>
                </>
              )}
              {conectado && (
                <button className="btn btn-ghost" style={{ fontSize: 12, gap: 6, color: "var(--accent-red)" }} onClick={disconnect}>
                  <Unplug size={13} /> Desconectar
                </button>
              )}
            </div>

            {!conectado && (
              <ol style={{
                margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6,
                fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6,
              }}>
                <li><strong style={{ color: "var(--text-secondary)" }}>Criar instância</strong> — registra o canal no servidor de mensagens</li>
                <li><strong style={{ color: "var(--text-secondary)" }}>Ver QR Code</strong> e aguardar o código aparecer</li>
                <li>No celular da empresa: WhatsApp → Menu → <em>Dispositivos conectados</em> → <em>Conectar dispositivo</em></li>
                <li>Escanear o código exibido acima</li>
              </ol>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

export default function WhatsAppConfigPage() {
  const { user } = useAuthStore();
  const [permsAberto, setPermsAberto] = useState(false);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Topbar />
      <main className="flex-1 overflow-y-auto page-content">
        <PageBody>
          <PageHeader
            icon={<MessageCircle size={22} />}
            title="WhatsApp"
            subtitle="Conexão do canal, permissões de mensagem e o seu número"
            accent="var(--accent-green)"
            actions={user?.isMaster ? (
              <button className="btn btn-violet" style={{ fontSize: 12, gap: 6 }} onClick={() => setPermsAberto(true)}>
                <ShieldCheck size={14} /> Permissões de mensagem
              </button>
            ) : undefined}
          />

          {/* Duas colunas em tela larga: conexão e permissões são assunto do
              master; o número é assunto de cada pessoa. Antes tudo empilhava
              numa coluna de 560px, deixando metade da tela vazia. */}
          <div style={{
            display: "grid",
            gridTemplateColumns: user?.isMaster ? "repeat(auto-fit, minmax(340px, 1fr))" : "1fr",
            gap: 16, alignItems: "start",
          }}>
            {user?.isMaster && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <OrgWhatsAppPanel />

                <Panel title="Permissões de mensagem">
                  <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 12px" }}>
                    Defina de quais módulos cada pessoa recebe notificação e por qual canal.
                    Quem não for configurado <strong>não recebe nada</strong>.
                  </p>
                  <button className="btn btn-ghost" style={{ fontSize: 12, gap: 6 }} onClick={() => setPermsAberto(true)}>
                    <ShieldCheck size={13} /> Abrir configuração
                  </button>
                </Panel>
              </div>
            )}

            <WhatsAppUserConfig />
          </div>
        </PageBody>
      </main>

      <PermissoesMensagemModal aberto={permsAberto} onFechar={() => setPermsAberto(false)} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
