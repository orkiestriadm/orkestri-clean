"use client";
import { useState } from "react";
import { HelpCircle, X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

/**
 * "Fale Conosco" — qualquer usuário logado manda uma dúvida, que chega por
 * e-mail (assunto HELP) para o admin. Pensado para o acesso de teste, mas
 * disponível para todos.
 */
export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok">("idle");
  const [erro, setErro] = useState("");

  if (!open) return null;

  const fechar = () => { setMsg(""); setStatus("idle"); setErro(""); onClose(); };

  const enviar = async () => {
    if (msg.trim().length < 3) { setErro("Escreva sua dúvida ou mensagem."); return; }
    setStatus("sending"); setErro("");
    try {
      await api.post("/auth/ajuda", { mensagem: msg.trim() });
      setStatus("ok");
    } catch (e: any) {
      setErro(e?.response?.data?.message || "Não foi possível enviar. Tente novamente.");
      setStatus("idle");
    }
  };

  return (
    <div role="dialog" aria-modal="true" onClick={fechar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: "var(--modal-bg)", border: "1px solid var(--border-medium)", borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.35)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--accent-violet, #f97316)18", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-violet, #f97316)" }}>
              <HelpCircle size={16} />
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-display)" }}>Fale Conosco</span>
          </div>
          <button onClick={fechar} className="btn-icon" style={{ width: 30, height: 30 }} title="Fechar"><X size={16} /></button>
        </div>

        {status === "ok" ? (
          <div style={{ padding: "32px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <CheckCircle2 size={40} style={{ color: "var(--accent-green)" }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Mensagem enviada!</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Nossa equipe recebeu e vai entrar em contato.</p>
            <button onClick={fechar} className="btn btn-violet" style={{ marginTop: 6 }}>Fechar</button>
          </div>
        ) : (
          <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Alguma dúvida ou precisa de ajuda? Escreva abaixo — o administrador recebe sua mensagem e responde.
            </p>
            <textarea
              value={msg}
              onChange={e => setMsg(e.target.value)}
              maxLength={2000}
              rows={5}
              autoFocus
              placeholder="Escreva sua mensagem..."
              className="input-o"
              style={{ resize: "vertical", minHeight: 110, padding: "10px 12px", lineHeight: 1.5 }}
            />
            {erro && <p role="alert" style={{ fontSize: 12, color: "var(--accent-red)" }}>{erro}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={fechar} className="btn btn-ghost">Cancelar</button>
              <button onClick={enviar} disabled={status === "sending"} className="btn btn-violet" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {status === "sending" ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Enviando...</> : <><Send size={14} /> Enviar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
