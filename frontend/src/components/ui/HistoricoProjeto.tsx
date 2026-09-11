"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Histórico do projeto (ou de uma tarefa): quem moveu cada cartão de coluna, e
 * quando o projeto foi concluído ou reaberto. Só leitura — é o registro.
 */

type Evento = {
  id: string;
  tipo: "tarefa_status" | "projeto_concluido" | "projeto_reaberto" | string;
  de: string | null;
  para: string | null;
  criadoEm: string;
  taskId: string | null;
  taskTitulo: string | null;
  user: { id: string; nome: string } | null;
};

const ROTULO: Record<string, string> = {
  A_FAZER: "A Fazer", EM_ANDAMENTO: "Em Andamento", EM_REVISAO: "Em Revisão", CONCLUIDA: "Concluída", CANCELADA: "Cancelada",
  PLANEJAMENTO: "Planejamento", PAUSADO: "Pausado", CONCLUIDO: "Concluído", CANCELADO: "Cancelado",
};

const COR: Record<string, string> = {
  A_FAZER: "var(--text-muted)", EM_ANDAMENTO: "var(--accent-cyan)", EM_REVISAO: "var(--accent-amber)",
  CONCLUIDA: "var(--accent-green)", CANCELADA: "var(--accent-red)",
};

function quando(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function Coluna({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] whitespace-nowrap align-middle">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: COR[status] ?? "var(--text-muted)" }} />
      {ROTULO[status] ?? status}
    </span>
  );
}

function corDoEvento(ev: Evento) {
  if (ev.tipo === "projeto_concluido") return "var(--accent-green)";
  if (ev.tipo === "projeto_reaberto") return "var(--accent-amber)";
  return COR[ev.para ?? ""] ?? "var(--border-medium)";
}

export default function HistoricoProjeto({ projectId, taskId, versao = 0 }: { projectId: string; taskId?: string; versao?: number }) {
  const [eventos,    setEventos]    = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro,       setErro]       = useState("");

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    api.get(`/projects/${projectId}/historico`, { params: taskId ? { taskId } : {}, silent: true })
      .then(({ data }) => { if (vivo) { setEventos(Array.isArray(data) ? data : []); setErro(""); } })
      .catch(() => { if (vivo) setErro("Não foi possível carregar o histórico."); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [projectId, taskId, versao]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-[11px] text-[var(--text-muted)] font-mono tracking-[0.08em]">HISTÓRICO ({eventos.length})</div>
        <div className="text-[12px] text-[var(--text-muted)] mt-0.5">
          {taskId
            ? "Quem moveu esta tarefa de coluna, e quando."
            : "Cada tarefa movida no quadro e cada vez que o projeto foi concluído ou reaberto."}
        </div>
      </div>

      {carregando ? (
        <div className="text-[12px] text-[var(--text-muted)] text-center py-5">Carregando…</div>
      ) : erro ? (
        <p className="text-[12px] text-[var(--accent-red)] m-0">{erro}</p>
      ) : eventos.length === 0 ? (
        <div className="text-[13px] text-[var(--text-muted)] text-center py-5">Nenhuma movimentação registrada ainda.</div>
      ) : (
        <ol className="flex flex-col m-0 p-0 list-none">
          {eventos.map((ev, i) => {
            const nome = ev.user?.nome ?? "Alguém";
            return (
              <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < eventos.length - 1 && <span className="absolute left-[5px] top-[18px] bottom-0 w-px bg-[var(--border-subtle)]" />}
                <span className="relative mt-[5px] w-[11px] h-[11px] rounded-full border-2 shrink-0 bg-[var(--bg-card)]" style={{ borderColor: corDoEvento(ev) }} />
                <div className="min-w-0 flex-1">
                  {ev.tipo === "projeto_concluido" ? (
                    <>
                      <div className="text-[13px] font-semibold text-[var(--accent-green)]">Projeto concluído</div>
                      <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        Todas as tarefas chegaram a Concluída (última movimentação: {nome}). Foi para Projetos Concluídos.
                      </div>
                    </>
                  ) : ev.tipo === "projeto_reaberto" ? (
                    <>
                      <div className="text-[13px] font-semibold text-[var(--accent-amber)]">Projeto reaberto</div>
                      <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        {nome} tirou uma tarefa de Concluída ou incluiu uma nova. O projeto voltou para a fila.
                      </div>
                    </>
                  ) : (
                    <div className="text-[13px] text-[var(--text-primary)] leading-[1.9]">
                      <strong className="font-semibold">{nome}</strong> moveu{" "}
                      {!taskId && <strong className="font-semibold break-words">“{ev.taskTitulo ?? "tarefa removida"}”</strong>}{" "}
                      de <Coluna status={ev.de} /> para <Coluna status={ev.para} />
                    </div>
                  )}
                  <time className="block mt-0.5 text-[10.5px] font-mono text-[var(--text-muted)]">{quando(ev.criadoEm)}</time>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
