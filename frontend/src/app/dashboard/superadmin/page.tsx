"use client";
import { useState, useEffect, useCallback } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type Org = {
  id: string; nome: string; slug: string; plano: string; ativo: boolean;
  criadoEm: string; usuarios: number; chamados: number;
  whatsapp: { instanceName: string; conectado: boolean; phoneNumber: string | null; ultimaConexao: string | null } | null;
};

type WaStatus = { connected: boolean; status: string };

function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: 20, background: color + "18", border: `1px solid ${color}40`, color }}>{label}</span>;
}

function Spin() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round" /></svg>;
}

function OrgCard({ org, onRefresh }: { org: Org; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [waStatus, setWaStatus] = useState<WaStatus | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ nome: "", email: "", senha: "" });
  const [inviting, setInviting] = useState(false);
  const [entering, setEntering] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const enterAsOrg = async () => {
    setEntering(true);
    try {
      await api.post(`/superadmin/organizations/${org.id}/impersonate`);
      window.location.href = "/dashboard";
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Erro ao entrar na organização", ok: false });
      setTimeout(() => setMsg(null), 4000);
      setEntering(false);
    }
  };

  const refreshWaStatus = useCallback(async () => {
    setWaLoading(true);
    try {
      const r = await api.get(`/superadmin/organizations/${org.id}/whatsapp/status`);
      setWaStatus(r.data);
    } catch { } finally { setWaLoading(false); }
  }, [org.id]);

  useEffect(() => { if (expanded) refreshWaStatus(); }, [expanded]);

  const createInstance = async () => {
    setWaLoading(true);
    try { await api.post(`/superadmin/organizations/${org.id}/whatsapp/create-instance`); await refreshWaStatus(); }
    catch { } finally { setWaLoading(false); }
  };

  const getQrCode = async () => {
    setQrLoading(true); setQr(null);
    try {
      const r = await api.get(`/superadmin/organizations/${org.id}/whatsapp/qrcode`);
      const b64 = r.data?.base64 || r.data?.qrcode?.base64;
      setQr(b64 ? `data:image/png;base64,${b64}` : null);
    } catch { } finally { setQrLoading(false); }
  };

  const disconnect = async () => {
    setWaLoading(true);
    try { await api.post(`/superadmin/organizations/${org.id}/whatsapp/disconnect`); await refreshWaStatus(); }
    catch { } finally { setWaLoading(false); }
  };

  const sendInvite = async () => {
    if (!invite.nome || !invite.email || !invite.senha) return;
    setInviting(true);
    try {
      await api.post(`/superadmin/organizations/${org.id}/invite-master`, invite);
      setMsg({ text: "Master convidado com sucesso!", ok: true });
      setInvite({ nome: "", email: "", senha: "" });
      setInviteOpen(false);
      onRefresh();
    } catch (e: any) {
      setMsg({ text: e?.response?.data?.message || "Erro ao convidar", ok: false });
    } finally { setInviting(false); setTimeout(() => setMsg(null), 4000); }
  };

  const planoColor = { starter: "var(--text-muted)", professional: "var(--accent-cyan)", enterprise: "var(--accent-violet)" }[org.plano] || "var(--text-muted)";

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: org.ativo ? "var(--accent-green)" : "var(--text-muted)", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>{org.nome}</span>
            <code style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>/{org.slug}</code>
            <Badge label={org.plano} color={planoColor} />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{org.usuarios} usuário{org.usuarios !== 1 ? "s" : ""}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{org.chamados} chamado{org.chamados !== 1 ? "s" : ""}</span>
            {org.whatsapp && (
              <span style={{ fontSize: 11, color: org.whatsapp.conectado ? "var(--accent-green)" : "var(--text-muted)" }}>
                WA {org.whatsapp.conectado ? "conectado" : "desconectado"}
              </span>
            )}
          </div>
        </div>
        {org.slug !== "default" && (
          <button
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: "4px 10px", flexShrink: 0 }}
            onClick={e => { e.stopPropagation(); enterAsOrg(); }}
            disabled={entering}
            title="Entrar no contexto desta organização"
          >
            {entering ? "Entrando..." : "Entrar como"}
          </button>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: "var(--text-muted)", flexShrink: 0 }}><path d="M6 9l6 6 6-6" /></svg>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {msg && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: msg.ok ? "rgba(52,211,153,0.08)" : "rgba(220,38,38,0.08)", border: "1px solid", borderColor: msg.ok ? "rgba(52,211,153,0.25)" : "rgba(220,38,38,0.25)", color: msg.ok ? "var(--accent-green)" : "var(--accent-red)", fontSize: 12 }}>
              {msg.text}
            </div>
          )}

          {/* WhatsApp section */}
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 10 }}>WHATSAPP DESTA ORGANIZAÇÃO</div>
            {waLoading ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 12 }}><Spin /> Verificando...</div>
            ) : waStatus ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: waStatus.connected ? "var(--accent-green)" : "var(--accent-red)" }} />
                  <span style={{ fontSize: 12, color: "var(--text-primary)" }}>{waStatus.connected ? "Conectado" : "Desconectado"} — {waStatus.status}</span>
                  {org.whatsapp?.instanceName && <code style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{org.whatsapp.instanceName}</code>}
                </div>
                {qr && <img src={qr} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 8, border: "1px solid var(--border-subtle)" }} />}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!waStatus.connected && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={createInstance}>Criar instância</button>}
                  {!waStatus.connected && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={getQrCode} disabled={qrLoading}>{qrLoading ? <Spin /> : "Ver QR Code"}</button>}
                  {waStatus.connected && <button className="btn btn-ghost" style={{ fontSize: 11, color: "var(--accent-red)" }} onClick={disconnect}>Desconectar</button>}
                  <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={refreshWaStatus}>Atualizar</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={createInstance}>Criar instância WA</button>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={refreshWaStatus}>Verificar</button>
              </div>
            )}
          </div>

          {/* Invite master */}
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 10 }}>USUÁRIO MASTER</div>
            {!inviteOpen ? (
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setInviteOpen(true)}>+ Convidar master</button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input className="input-o" placeholder="Nome" value={invite.nome} onChange={e => setInvite(i => ({ ...i, nome: e.target.value }))} style={{ fontSize: 12 }} />
                <input className="input-o" placeholder="E-mail" type="email" value={invite.email} onChange={e => setInvite(i => ({ ...i, email: e.target.value }))} style={{ fontSize: 12 }} />
                <input className="input-o" placeholder="Senha inicial" type="password" value={invite.senha} onChange={e => setInvite(i => ({ ...i, senha: e.target.value }))} style={{ fontSize: 12 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-violet" style={{ fontSize: 11 }} onClick={sendInvite} disabled={inviting}>{inviting ? <Spin /> : "Enviar convite"}</button>
                  <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => setInviteOpen(false)}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NewOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nome: "", slug: "", plano: "starter" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.nome || !form.slug) { setErr("Nome e slug são obrigatórios"); return; }
    setLoading(true); setErr("");
    try {
      await api.post("/superadmin/organizations", form);
      onCreated();
    } catch (e: any) { setErr(e?.response?.data?.message || "Erro ao criar"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div className="card" style={{ width: 420, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700 }}>Nova Organização</div>
        {err && <div style={{ fontSize: 12, color: "var(--accent-red)" }}>{err}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input className="input-o" placeholder="Nome da organização" value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") }))} />
          <input className="input-o" placeholder="Slug (ex: empresa-abc)" value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))} />
          <select className="input-o" value={form.plano} onChange={e => setForm(f => ({ ...f, plano: e.target.value }))}>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-violet" style={{ flex: 1 }} onClick={submit} disabled={loading}>{loading ? <Spin /> : "Criar"}</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const { user } = useAuthStore();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOrgOpen, setNewOrgOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/superadmin/organizations"); setOrgs(r.data); }
    catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, []);

  if (!user?.isMaster) {
    return (
      <div className="flex flex-col h-full bg-background">
        <Topbar />
        <div className="flex-1 flex items-center justify-center">
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Acesso restrito a super-admins</div>
        </div>
      </div>
    );
  }

  const topbarActions = (
    <button className="btn btn-violet" style={{ fontSize: 12 }} onClick={() => setNewOrgOpen(true)}>
      + Nova Organização
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <Topbar>{topbarActions}</Topbar>
      <div className="flex-1 overflow-y-auto p-6">
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>Super Admin</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{orgs.length} organização{orgs.length !== 1 ? "s" : ""} cadastrada{orgs.length !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin /></div>
          ) : orgs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "var(--text-muted)", fontSize: 13 }}>Nenhuma organização encontrada</div>
          ) : (
            orgs.map(org => <OrgCard key={org.id} org={org} onRefresh={load} />)
          )}
        </div>
      </div>
      {newOrgOpen && <NewOrgModal onClose={() => setNewOrgOpen(false)} onCreated={() => { setNewOrgOpen(false); load(); }} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
