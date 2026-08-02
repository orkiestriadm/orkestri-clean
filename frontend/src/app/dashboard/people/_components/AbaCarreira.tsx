"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useToastStore } from "@/lib/toast";
import {
  careerService, SituacaoCarreira, Trilha, RequisitoAvaliado, CriterioDegrau,
  SituacaoRequisito, NIVEIS_COMPETENCIA,
} from "@/lib/people/career.service";
import { Panel, PermissionDenied, StatusBadge } from "@/components/data-ui";
import { Route, Check, Circle, Eye, Award, GraduationCap, ClipboardCheck } from "lucide-react";

/**
 * Carreira do colaborador.
 *
 * A trilha desenhada é o pano de fundo; o que esta aba existe para responder é
 * "o que falta para o próximo degrau". Cada pendência aparece com nome — a
 * competência, o curso, quantos meses — porque "68% pronto" sozinho não diz a
 * ninguém o que fazer na segunda-feira.
 */

const ICONE_TIPO: Record<string, React.ReactNode> = {
  competencia: <Award size={12} />,
  treinamento: <GraduationCap size={12} />,
  manual: <ClipboardCheck size={12} />,
};

const CORES: Record<SituacaoRequisito, { cor: string; icone: React.ReactNode; rotulo: string }> = {
  atendido: {
    cor: "var(--accent-emerald, #10b981)",
    icone: <Check size={13} />,
    rotulo: "Atendido",
  },
  pendente: {
    cor: "var(--text-muted)",
    icone: <Circle size={11} />,
    rotulo: "Pendente",
  },
  conferencia_manual: {
    cor: "var(--accent-amber, #f59e0b)",
    icone: <Eye size={12} />,
    rotulo: "Conferência",
  },
};

type Props = {
  collaboratorId: string;
  podeGerenciar: boolean;
};

export default function AbaCarreira({ collaboratorId, podeGerenciar }: Props) {
  const [dados, setDados] = useState<SituacaoCarreira | null>(null);
  const [trilhas, setTrilhas] = useState<Trilha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await careerService.situacao(collaboratorId);
      setDados(r.data);
      setSemPermissao(false);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar a carreira");
    } finally {
      setCarregando(false);
    }
  }, [collaboratorId]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (!podeGerenciar) return;
    careerService.trilhas().then(r => setTrilhas(r.data ?? [])).catch(() => setTrilhas([]));
  }, [podeGerenciar]);

  async function definirTrilha(id: string) {
    try {
      await careerService.definirTrilha(collaboratorId, id || null);
      useToastStore.getState().success(id ? "Trilha atribuída" : "Trilha removida");
      carregar();
    } catch { /* interceptor */ }
  }

  if (semPermissao) {
    return <PermissionDenied hint="Você não tem permissão para ver o plano de carreira." />;
  }
  if (carregando) {
    return <Panel title="CARREIRA"><Texto>Carregando…</Texto></Panel>;
  }
  if (erro) {
    return <Panel title="CARREIRA"><Texto>{erro}</Texto></Panel>;
  }
  if (!dados) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {podeGerenciar && (
        <SeletorTrilha
          trilhas={trilhas}
          atual={dados.trilha?.id ?? ""}
          inferida={dados.inferida}
          onMudar={definirTrilha}
        />
      )}

      {!dados.trilha ? (
        <Panel title="CARREIRA">
          <Texto>
            <strong style={{ color: "var(--text-primary)" }}>Sem trilha definida.</strong>{" "}
            {dados.motivo}{" "}
            {podeGerenciar ? (
              <>
                Escolha uma trilha acima, ou desenhe uma em{" "}
                <Link href="/dashboard/people/carreira" style={{ color: "var(--accent-violet)" }}>
                  Trilhas de carreira
                </Link>.
              </>
            ) : null}
          </Texto>
        </Panel>
      ) : (
        <>
          <Panel
            title={`TRILHA · ${dados.trilha.nome.toUpperCase()}`}
            actions={dados.inferida ? <StatusBadge label="Inferida pelo cargo" tone="info" /> : undefined}
          >
            <Escada degraus={dados.degraus ?? []} />
          </Panel>

          {dados.foraDaTrilha ? (
            <Panel title="PRÓXIMO DEGRAU">
              <Texto>
                O cargo atual não é um degrau desta trilha, então não há próximo passo a
                calcular. Ajuste a trilha ou o cargo do colaborador.
              </Texto>
            </Panel>
          ) : dados.noTopo ? (
            <Panel title="PRÓXIMO DEGRAU">
              <Texto>
                <strong style={{ color: "var(--text-primary)" }}>Topo da trilha.</strong>{" "}
                Não há degrau seguinte — o próximo passo daqui é uma mudança de trilha,
                não de degrau.
              </Texto>
            </Panel>
          ) : (
            <Prontidao dados={dados} />
          )}
        </>
      )}
    </div>
  );
}

function Texto({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.65, margin: 0 }}>
      {children}
    </p>
  );
}

function SeletorTrilha({
  trilhas, atual, inferida, onMudar,
}: {
  trilhas: Trilha[]; atual: string; inferida: boolean; onMudar: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span className="mono-cap" style={{ color: "var(--text-muted)" }}>Trilha</span>
      <select
        className="input-o"
        style={{ maxWidth: 320 }}
        // Trilha inferida não é escolha gravada: mostrar como selecionada faria
        // parecer que alguém decidiu, quando foi o sistema que deduziu.
        value={inferida ? "" : atual}
        onChange={e => onMudar(e.target.value)}
      >
        <option value="">{inferida ? "Inferida pelo cargo" : "Nenhuma"}</option>
        {trilhas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
    </div>
  );
}

function Escada({
  degraus,
}: {
  degraus: NonNullable<SituacaoCarreira["degraus"]>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {degraus.map(d => (
        <div
          key={d.id}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", borderRadius: 12,
            background: d.atual ? "color-mix(in srgb, var(--accent-violet) 10%, transparent)" : "transparent",
            border: d.atual
              ? "1px solid color-mix(in srgb, var(--accent-violet) 30%, transparent)"
              : "1px solid var(--border-subtle)",
          }}
        >
          <span
            className="metric"
            style={{
              width: 24, height: 24, borderRadius: 7, flexShrink: 0,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 11.5, fontWeight: 700,
              background: "var(--bg-tertiary)", color: "var(--text-secondary)",
            }}
          >
            {d.ordem}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: d.atual ? 700 : 500 }}>
              {d.cargo ?? "Cargo removido"}
            </div>
            {(d.mesesMinimos != null || d.notaMinima != null || d.totalRequisitos > 0) && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                {[
                  d.mesesMinimos != null ? `${d.mesesMinimos} meses` : null,
                  d.notaMinima != null ? `nota ${d.notaMinima}` : null,
                  d.totalRequisitos > 0
                    ? `${d.totalRequisitos} ${d.totalRequisitos === 1 ? "requisito" : "requisitos"}`
                    : null,
                ].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
          {d.atual && <StatusBadge label="Você está aqui" tone="info" />}
        </div>
      ))}
    </div>
  );
}

function Prontidao({ dados }: { dados: SituacaoCarreira }) {
  const p = dados.prontidao;
  if (!p) return null;

  const itens: { chave: string; rotulo: string; detalhe: string; situacao: SituacaoRequisito; icone?: React.ReactNode }[] = [
    ...p.criterios.map((c: CriterioDegrau, i: number) => ({
      chave: `c${i}`, rotulo: c.rotulo, detalhe: c.detalhe, situacao: c.situacao,
    })),
    ...p.requisitos.map((r: RequisitoAvaliado) => ({
      chave: r.id,
      rotulo: rotulo(r),
      detalhe: detalhe(r),
      situacao: r.situacao,
      icone: ICONE_TIPO[r.tipo],
    })),
  ];

  return (
    <Panel
      title={`PARA CHEGAR A ${(dados.proximoDegrau?.cargo ?? "").toUpperCase()}`}
      actions={
        <StatusBadge
          label={p.pronto ? "Requisitos cumpridos" : `${p.percentual}% do caminho`}
          tone={p.pronto ? "ok" : "atencao"}
        />
      }
    >
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            height: 7, borderRadius: 999, overflow: "hidden",
            background: "var(--bg-tertiary)",
          }}
        >
          <div
            style={{
              width: `${p.percentual}%`, height: "100%",
              background: p.pronto ? "var(--accent-emerald, #10b981)" : "var(--accent-violet)",
              transition: "width .4s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.55 }}>
          {dados.mesesNoCargo != null && (
            <>
              {dados.mesesNoCargo} {dados.mesesNoCargo === 1 ? "mês" : "meses"} no cargo atual
              {p.conferenciasManuais > 0 ? " · " : ""}
            </>
          )}
          {p.conferenciasManuais > 0 && (
            <>
              {p.conferenciasManuais}{" "}
              {p.conferenciasManuais === 1 ? "item depende" : "itens dependem"} de conferência
              — o percentual não os inclui porque o sistema não os decide.
            </>
          )}
        </div>
      </div>

      {itens.length === 0 ? (
        <Texto>
          Este degrau não tem requisitos cadastrados. A progressão depende inteiramente
          de decisão de gestão.
        </Texto>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {itens.map(i => {
            const c = CORES[i.situacao];
            return (
              <div
                key={i.chave}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 11px", borderRadius: 11,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-secondary)",
                  opacity: i.situacao === "pendente" ? 0.85 : 1,
                }}
              >
                <span
                  style={{
                    width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    color: c.cor,
                    background: `color-mix(in srgb, ${c.cor} 14%, transparent)`,
                  }}
                  title={c.rotulo}
                >
                  {c.icone}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    {i.icone}
                    {i.rotulo}
                  </div>
                  {i.detalhe && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      {i.detalhe}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dados.proximoDegrau?.observacoes && (
        <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 0, marginTop: 14 }}>
          {dados.proximoDegrau.observacoes}
        </p>
      )}
    </Panel>
  );
}

function rotulo(r: RequisitoAvaliado): string {
  if (r.tipo === "competencia") return r.skillNome ?? r.skill?.nome ?? "Competência";
  if (r.tipo === "treinamento") return r.trainingNome ?? r.training?.nome ?? "Treinamento";
  return r.descricao ?? "Conferência manual";
}

function detalhe(r: RequisitoAvaliado): string {
  const partes: string[] = [];

  if (r.tipo === "competencia") {
    const exigido = NIVEIS_COMPETENCIA.find(n => n.value === r.nivelMinimo)?.label;
    const atual = NIVEIS_COMPETENCIA.find(n => n.value === r.nivelAtual)?.label;
    if (exigido) partes.push(`exige ${exigido}`);
    partes.push(atual ? `hoje ${atual}` : "não registrada");
  }

  if (r.tipo === "treinamento") {
    partes.push(r.situacao === "atendido" ? "concluído" : "não concluído");
  }

  if (!r.obrigatorio) partes.push("diferencial");
  if (r.tipo !== "manual" && r.descricao) partes.push(r.descricao);

  return partes.join(" · ");
}
