"use client";
import { useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  HeartPulse, Database, Building2, Users, ShieldAlert, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, Archive, HardDrive, Play, Power, Wrench,
} from "lucide-react";

type BackupInfo = { ultimo: string | null; idadeHoras: number | null; status: "ok" | "atrasado" | "nunca"; ativo: boolean; arquivos: number };
type Saude = {
  geradoEm: string;
  backups: { full: BackupInfo; incremental: BackupInfo };
  banco: { tamanho: string };
  plataforma: { organizacoes: number; usuarios: number; usuariosAtivos: number };
};

const STATUS_META: Record<string, { label: string; cor: string; bg: string; Icon: any }> = {
  ok:       { label: "Em dia",     cor: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", Icon: CheckCircle2 },
  atrasado: { label: "Atrasado",   cor: "text-red-500",     bg: "bg-red-500/10 border-red-500/20",         Icon: AlertTriangle },
  nunca:    { label: "Nunca rodou", cor: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/20",     Icon: XCircle },
};

function idadeLegivel(h: number | null) {
  if (h === null) return "—";
  if (h < 1) return `há ${Math.round(h * 60)} min`;
  if (h < 48) return `há ${Math.round(h)} h`;
  return `há ${Math.round(h / 24)} dias`;
}

function KpiTile({ icon: Icon, label, value, sub, tom }: { icon: any; label: string; value: string | number; sub?: string; tom?: string }) {
  return (
    <div className="card-premium p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide">{label}</span>
        <Icon size={15} className={tom || "text-[var(--text-muted)]"} />
      </div>
      <div className={cn("metric text-[22px] leading-none", tom || "text-[var(--text-primary)]")}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--text-muted)] mt-1.5">{sub}</div>}
    </div>
  );
}

export default function PlataformaSaudePage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<Saude | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [running, setRunning] = useState<string>("");   // "full" | "incremental" | "fix" | "toggle-full" | "toggle-incremental"
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const load = () => {
    setLoading(true);
    api.get("/sistema/plataforma/saude")
      .then(r => { setData(r.data); setErro(""); })
      .catch(e => setErro(e?.response?.data?.message || "Não foi possível carregar a saúde da plataforma"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function rodarBackup(tipo: "full" | "incremental", tag = tipo) {
    setRunning(tag); setMsg(null);
    try {
      const r = await api.post(`/sistema/backup/${tipo}`);
      if (r.data?.sucesso) setMsg({ tipo: "ok", texto: `Backup ${tipo === "full" ? "completo" : "incremental"} gerado com sucesso.` });
      else setMsg({ tipo: "erro", texto: r.data?.erro || "Falha ao gerar o backup." });
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.response?.data?.message || "Falha ao gerar o backup." });
    } finally { setRunning(""); load(); }
  }

  async function ligarAgendador(tipo: "full" | "incremental") {
    setRunning(`toggle-${tipo}`); setMsg(null);
    try {
      await api.post("/sistema/config", tipo === "full" ? { backupFullAtivo: true } : { backupIncrementalAtivo: true });
      setMsg({ tipo: "ok", texto: "Agendador ligado." });
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.response?.data?.message || "Não foi possível ligar o agendador." });
    } finally { setRunning(""); load(); }
  }

  // Corrige tudo que estiver com problema, em sequência.
  async function corrigirTudo() {
    if (!data) return;
    setRunning("fix"); setMsg(null);
    try {
      if (data.backups.incremental.status !== "ok") await api.post("/sistema/backup/incremental").catch(() => {});
      if (data.backups.full.status !== "ok") await api.post("/sistema/backup/full").catch(() => {});
      setMsg({ tipo: "ok", texto: "Correção executada. Recarregando o status…" });
    } finally { setRunning(""); load(); }
  }

  // Defesa em profundidade: rota já escondida do menu, mas barra aqui também.
  if (user && !(user as any).isSuperAdmin) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-primary)]">
        <Topbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
          <ShieldAlert size={32} className="text-[var(--text-muted)]" />
          <div className="text-[14px] font-medium text-[var(--text-primary)]">Acesso restrito</div>
          <div className="text-[13px] text-[var(--text-secondary)]">Esta área é exclusiva do Super Admin da plataforma.</div>
        </div>
      </div>
    );
  }

  const problemas = data ? [data.backups.full, data.backups.incremental].filter(b => b.status !== "ok").length : 0;
  const saudavel = data && problemas === 0;

  function BackupCard({ titulo, tipo, info }: { titulo: string; tipo: "full" | "incremental"; info: BackupInfo }) {
    const meta = STATUS_META[info.status] ?? STATUS_META.nunca;
    const rodando = running === tipo || running === "fix";
    const problema = info.status !== "ok";
    return (
      <div className={cn("card-premium p-5", problema && "ring-1 ring-red-500/20")}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-[var(--text-muted)]" />
            <span className="text-[13px] font-semibold text-[var(--text-primary)]">{titulo}</span>
          </div>
          <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border", meta.bg, meta.cor)}>
            <meta.Icon size={12} /> {meta.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          <div>
            <div className="text-[11px] text-[var(--text-muted)] mb-0.5">Último</div>
            <div className="text-[13px] font-medium text-[var(--text-secondary)]">{idadeLegivel(info.idadeHoras)}</div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--text-muted)] mb-0.5">Arquivos</div>
            <div className="metric text-[18px] text-[var(--text-primary)]">{info.arquivos}</div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--text-muted)] mb-0.5">Agendador</div>
            <div className={cn("text-[13px] font-medium", info.ativo ? "text-emerald-500" : "text-amber-500")}>
              {info.ativo ? "Ativo" : "Desligado"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => rodarBackup(tipo)} disabled={!!running}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all disabled:opacity-50",
              problema
                ? "bg-red-500 text-white hover:bg-red-600"
                : "border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
            {rodando ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
            {rodando ? "Rodando…" : problema ? "Corrigir — rodar agora" : "Rodar agora"}
          </button>
          {!info.ativo && (
            <button onClick={() => ligarAgendador(tipo)} disabled={!!running}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-all disabled:opacity-50">
              {running === `toggle-${tipo}` ? <RefreshCw size={13} className="animate-spin" /> : <Power size={13} />}
              Ligar agendador
            </button>
          )}
        </div>
        {info.ultimo && (
          <div className="text-[11px] text-[var(--text-muted)] mt-3 pt-3 border-t border-[var(--border-subtle)]">
            {new Date(info.ultimo).toLocaleString("pt-BR")}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <Topbar />
      <div className="flex-1 overflow-y-auto page-content">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-8 space-y-6">

          {/* Cabeçalho */}
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <HeartPulse size={14} className="text-[var(--text-muted)]" />
                <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-widest">Plataforma · Super Admin</span>
              </div>
              <h2 className="font-display text-[26px] font-bold text-[var(--text-primary)] tracking-tight">Saúde da Plataforma</h2>
            </div>
            <button onClick={load} disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all disabled:opacity-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
          </div>

          {msg && (
            <div className={cn("flex items-center gap-2 p-3 rounded-xl text-[13px] border",
              msg.tipo === "ok" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-red-500/10 border-red-500/20 text-red-500")}>
              {msg.tipo === "ok" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {msg.texto}
            </div>
          )}
          {erro && (
            <div className="card-premium p-4 flex items-center gap-2 text-[13px] text-red-500"><AlertTriangle size={15} /> {erro}</div>
          )}

          {loading && !data ? (
            <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-[13px]">
              <RefreshCw size={15} className="animate-spin mr-2" /> Carregando…
            </div>
          ) : data && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiTile icon={saudavel ? CheckCircle2 : AlertTriangle}
                  label="Status geral" value={saudavel ? "Saudável" : `${problemas} alerta${problemas > 1 ? "s" : ""}`}
                  tom={saudavel ? "text-emerald-500" : "text-red-500"} />
                <KpiTile icon={HardDrive} label="Banco de dados" value={data.banco.tamanho} />
                <KpiTile icon={Building2} label="Organizações" value={data.plataforma.organizacoes} />
                <KpiTile icon={Users} label="Usuários" value={data.plataforma.usuarios} sub={`${data.plataforma.usuariosAtivos} ativos`} />
              </div>

              {/* Banner de saúde + correção rápida */}
              {saudavel ? (
                <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <div className="text-[13px] text-emerald-500">Backups em dia. Plataforma saudável.</div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-start gap-2.5 flex-1">
                    <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                    <div className="text-[13px] text-red-500">
                      <strong>Atenção:</strong> {problemas} item de backup não está em dia. Sem backup recente, uma restauração pode perder dados.
                    </div>
                  </div>
                  <button onClick={corrigirTudo} disabled={!!running}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-[12px] font-medium hover:bg-red-600 transition-all disabled:opacity-50 shrink-0">
                    {running === "fix" ? <RefreshCw size={13} className="animate-spin" /> : <Wrench size={13} />}
                    {running === "fix" ? "Corrigindo…" : "Corrigir agora"}
                  </button>
                </div>
              )}

              {/* Backups */}
              <div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-2">Backups</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <BackupCard titulo="Backup completo (diário)" tipo="full" info={data.backups.full} />
                  <BackupCard titulo="Backup incremental (horário)" tipo="incremental" info={data.backups.incremental} />
                </div>
              </div>

              <div className="text-[11px] text-[var(--text-muted)] text-right">
                Atualizado em {new Date(data.geradoEm).toLocaleString("pt-BR")}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
