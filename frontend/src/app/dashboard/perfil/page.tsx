"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { User, Lock, Bell, Shield, Save, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Perfil {
  id: string; nome: string; email: string; ativo: boolean;
  cargo?: string; telefone?: string;
  whatsapp?: string; whatsappAlertas?: boolean;
  statusOnline?: string;
  setor?: { id: string; nome: string; cor?: string } | null;
  roles: string[]; isMaster: boolean;
  criadoEm: string; ultimoLogin?: string;
}

const STATUS_OPTS = [
  { value: "disponivel",  label: "Disponível",       dot: "bg-green-500"  },
  { value: "ausente",     label: "Ausente",           dot: "bg-yellow-500" },
  { value: "ocupado",     label: "Ocupado",           dot: "bg-red-500"    },
  { value: "invisivel",   label: "Invisível",         dot: "bg-gray-500"   },
];

function fmtDt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" });
}

export default function PerfilPage() {
  const { user: authUser } = useAuthStore();
  const [tab, setTab] = useState<"info" | "seguranca" | "notificacoes">("info");
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  // info fields
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [statusOnline, setStatusOnline] = useState("disponivel");
  const [saving, setSaving] = useState(false);
  const [savedInfo, setSavedInfo] = useState(false);

  // notificações
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappAlertas, setWhatsappAlertas] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);
  const [savedNotif, setSavedNotif] = useState(false);

  // senha
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showAtual, setShowAtual] = useState(false);
  const [showNova, setShowNova] = useState(false);
  const [savingSenha, setSavingSenha] = useState(false);
  const [senhaError, setSenhaError] = useState("");
  const [senhaOk, setSenhaOk] = useState(false);

  useEffect(() => {
    api.get<Perfil>("/users/me").then(r => {
      const p = r.data;
      setPerfil(p);
      setNome(p.nome || "");
      setTelefone(p.telefone || "");
      setCargo(p.cargo || "");
      setStatusOnline(p.statusOnline || "disponivel");
      setWhatsapp(p.whatsapp || "");
      setWhatsappAlertas(p.whatsappAlertas ?? false);
    }).finally(() => setLoading(false));
  }, []);

  async function saveInfo() {
    setSaving(true);
    try {
      const r = await api.patch<Perfil>("/users/me", { nome, telefone, cargo, statusOnline });
      setPerfil(r.data);
      setSavedInfo(true);
      setTimeout(() => setSavedInfo(false), 3000);
    } finally { setSaving(false); }
  }

  async function saveNotif() {
    setSavingNotif(true);
    try {
      await api.patch("/users/me", { whatsapp, whatsappAlertas });
      setSavedNotif(true);
      setTimeout(() => setSavedNotif(false), 3000);
    } finally { setSavingNotif(false); }
  }

  async function changeSenha() {
    setSenhaError(""); setSenhaOk(false);
    if (!senhaAtual || !novaSenha || !confirmar) { setSenhaError("Preencha todos os campos"); return; }
    if (novaSenha.length < 6) { setSenhaError("Nova senha deve ter ao menos 6 caracteres"); return; }
    if (novaSenha !== confirmar) { setSenhaError("As senhas não coincidem"); return; }
    setSavingSenha(true);
    try {
      await api.patch("/users/me/senha", { senhaAtual, novaSenha });
      setSenhaOk(true);
      setSenhaAtual(""); setNovaSenha(""); setConfirmar("");
      setTimeout(() => setSenhaOk(false), 4000);
    } catch (e: any) {
      setSenhaError(e?.response?.data?.message || "Erro ao alterar senha");
    } finally { setSavingSenha(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 size={28} className="animate-spin text-muted-foreground" />
    </div>
  );

  const initials = (perfil?.nome || "U").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const statusOpt = STATUS_OPTS.find(s => s.value === statusOnline) || STATUS_OPTS[0];

  return (
    <div className="min-h-screen bg-background p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header card */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/40 to-cyan-400/30 border-2 border-primary/30 flex items-center justify-center text-xl font-bold text-primary">
                {initials}
              </div>
              <span className={cn("absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-card", statusOpt.dot)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold text-foreground truncate">{perfil?.nome}</div>
              <div className="text-sm text-muted-foreground">{perfil?.email}</div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {perfil?.isMaster && (
                  <span className="text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">MASTER</span>
                )}
                {perfil?.roles.map(r => (
                  <span key={r} className="text-[11px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">{r}</span>
                ))}
                {perfil?.setor && (
                  <span className="text-[11px] text-muted-foreground">📍 {perfil.setor.nome}</span>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground space-y-1 flex-shrink-0 hidden sm:block">
              <div>Conta criada</div>
              <div className="font-mono">{fmtDt(perfil?.criadoEm)}</div>
              <div className="mt-2">Último acesso</div>
              <div className="font-mono">{fmtDt(perfil?.ultimoLogin)}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {([
            { key: "info",          label: "Informações",    Icon: User   },
            { key: "notificacoes",  label: "Notificações",   Icon: Bell   },
            { key: "seguranca",     label: "Segurança",      Icon: Lock   },
          ] as const).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-all",
                tab === key ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted/50")}>
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab: Informações ─────────────────────────────────────────────────── */}
        {tab === "info" && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Informações pessoais</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Nome completo</label>
                <input value={nome} onChange={e => setNome(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">E-mail</label>
                <input value={perfil?.email || ""} disabled
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Cargo</label>
                <input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Analista de Suporte"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Telefone</label>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Status de presença</label>
              <div className="flex gap-2 flex-wrap">
                {STATUS_OPTS.map(s => (
                  <button key={s.value} onClick={() => setStatusOnline(s.value)}
                    className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all",
                      statusOnline === s.value
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground")}>
                    <span className={cn("w-2 h-2 rounded-full", s.dot)} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              {savedInfo ? (
                <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={16} />Salvo!</div>
              ) : <div />}
              <button onClick={saveInfo} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Notificações ────────────────────────────────────────────────── */}
        {tab === "notificacoes" && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Notificações por WhatsApp</h2>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Número WhatsApp</label>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
                placeholder="5511999999999 (com código do país)"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <p className="text-[11px] text-muted-foreground">Formato: código do país + DDD + número. Ex: 5511999999999</p>
            </div>

            <div className="flex items-center justify-between py-3 px-4 rounded-xl border border-border bg-muted/30">
              <div>
                <div className="text-sm font-medium text-foreground">Alertas por WhatsApp</div>
                <div className="text-xs text-muted-foreground mt-0.5">Receba notificações de chamados e atribuições</div>
              </div>
              <button onClick={() => setWhatsappAlertas(v => !v)}
                className={cn("w-11 h-6 rounded-full border transition-all relative",
                  whatsappAlertas ? "bg-primary border-primary" : "bg-muted border-border")}>
                <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
                  whatsappAlertas ? "left-[22px]" : "left-0.5")} />
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              {savedNotif ? (
                <div className="flex items-center gap-2 text-green-400 text-sm"><CheckCircle size={16} />Salvo!</div>
              ) : <div />}
              <button onClick={saveNotif} disabled={savingNotif}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {savingNotif ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Salvar
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Segurança ───────────────────────────────────────────────────── */}
        {tab === "seguranca" && (
          <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Alterar senha</h2>
            </div>

            <div className="space-y-3 max-w-sm">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Senha atual</label>
                <div className="relative">
                  <input type={showAtual ? "text" : "password"} value={senhaAtual}
                    onChange={e => setSenhaAtual(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  <button type="button" onClick={() => setShowAtual(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showAtual ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Nova senha</label>
                <div className="relative">
                  <input type={showNova ? "text" : "password"} value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                  <button type="button" onClick={() => setShowNova(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNova ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Confirmar nova senha</label>
                <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)}
                  className={cn("w-full bg-background border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50",
                    confirmar && confirmar !== novaSenha ? "border-red-500/50" : "border-border")} />
              </div>

              {confirmar && novaSenha && confirmar !== novaSenha && (
                <p className="text-xs text-red-400">As senhas não coincidem</p>
              )}
            </div>

            {senhaError && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                {senhaError}
              </div>
            )}
            {senhaOk && (
              <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2.5">
                <CheckCircle size={16} />Senha alterada com sucesso!
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <button onClick={changeSenha} disabled={savingSenha}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                {savingSenha ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                Alterar senha
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
