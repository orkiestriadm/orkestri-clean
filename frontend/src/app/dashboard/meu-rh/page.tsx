"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Topbar from "@/components/layout/Topbar";
import { meService, MeuResumo } from "@/lib/people/me.service";
import {
  PageBody, BackLink, PageHeader, Panel, KpiCard, KpiGrid,
  ErrorState, StatusBadge, Tabs,
} from "@/components/data-ui";
import Vazio from "./_components/Vazio";
import {
  UserCircle, CalendarClock, FileText, ClipboardList, Route,
  AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import { formatarDataBR } from "@/lib/datas";
import MinhasFerias from "./_components/MinhasFerias";
import MeusDocumentos from "./_components/MeusDocumentos";
import MinhaCarreira from "./_components/MinhaCarreira";
import MinhasAvaliacoes from "./_components/MinhasAvaliacoes";

/**
 * Meu RH — o módulo pela ótica de quem é o objeto dele.
 *
 * Todas as outras telas do People respondem "como está o quadro?". Esta
 * responde "como estou eu, e o que depende de mim?". Não é a mesma tela com
 * menos dados: a ordem muda. O que abre a página são as PENDÊNCIAS, não o
 * cadastro — quem entra aqui já sabe o próprio nome.
 *
 * Nenhuma chamada desta página manda um id de colaborador. O backend resolve
 * pelo token, e é isso que garante que não há como pedir o dado de um colega.
 */

type Aba = "resumo" | "ferias" | "documentos" | "avaliacoes" | "carreira";

export default function MeuRhPage() {
  const [resumo, setResumo] = useState<MeuResumo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [semVinculo, setSemVinculo] = useState("");
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<Aba>("resumo");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    setSemVinculo("");
    try {
      const r = await meService.resumo();
      setResumo(r.data);
    } catch (e: any) {
      // 404 aqui não é "página não existe": é usuário sem cadastro de
      // colaborador. A mensagem do backend diz o que fazer, e repetir um
      // "não encontrado" genérico deixaria a pessoa sem saída.
      if (e?.response?.status === 404) setSemVinculo(e?.response?.data?.message ?? "");
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar os seus dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (semVinculo) {
    return (
      <>
        <Topbar />
        <PageBody>
          <BackLink />
          <PageHeader icon={<UserCircle size={22} />} title="Meu RH" />
          <Panel>
            <Vazio
              icon={<UserCircle size={28} />}
              titulo="Seu usuário ainda não tem cadastro de colaborador"
              dica={semVinculo}
            />
          </Panel>
        </PageBody>
      </>
    );
  }

  if (erro) {
    return (
      <>
        <Topbar />
        <PageBody>
          <BackLink />
          <ErrorState detail={erro} onRetry={carregar} />
        </PageBody>
      </>
    );
  }

  const c = resumo?.colaborador;

  return (
    <>
      <Topbar />
      <PageBody>
        <BackLink />
        <PageHeader
          icon={<UserCircle size={22} />}
          title={carregando ? "Meu RH" : `Olá, ${primeiroNome(c?.nome)}`}
          subtitle={
            c
              ? [c.cargo, c.setor].filter(Boolean).join(" · ") || "Sem cargo definido"
              : "Carregando os seus dados…"
          }
        />

        <Tabs<Aba>
          active={aba}
          onChange={setAba}
          tabs={[
            { id: "resumo",     label: "Resumo" },
            { id: "ferias",     label: "Férias" },
            { id: "documentos", label: "Documentos" },
            { id: "avaliacoes", label: "Avaliações" },
            { id: "carreira",   label: "Carreira" },
          ]}
        />

        {aba === "resumo" && (
          <Resumo dados={resumo} carregando={carregando} onIrPara={setAba} />
        )}
        {aba === "ferias" && <MinhasFerias onAlterou={carregar} />}
        {aba === "documentos" && <MeusDocumentos onAlterou={carregar} />}
        {aba === "avaliacoes" && <MinhasAvaliacoes />}
        {aba === "carreira" && <MinhaCarreira />}
      </PageBody>
    </>
  );
}

/* ── Resumo ──────────────────────────────────────────────────────────────── */

function Resumo({
  dados, carregando, onIrPara,
}: {
  dados: MeuResumo | null;
  carregando: boolean;
  onIrPara: (a: Aba) => void;
}) {
  if (carregando || !dados) {
    return <Panel title="Carregando"><p className="muted">Buscando os seus dados…</p></Panel>;
  }

  const { ferias, documentos, pendencias, carreira, colaborador } = dados;
  const atrasadas = pendencias.filter(p => p.situacao === "atrasado");

  return (
    <>
      <KpiGrid>
        <KpiCard
          label="Dias de férias disponíveis"
          valor={ferias.semDataAdmissao ? "—" : ferias.saldoDisponivel}
          icon={<CalendarClock size={18} />}
          index={0}
          hint={ferias.semDataAdmissao
            ? "Sem data de admissão no cadastro, não há como calcular"
            : undefined}
        />
        {/* Só aparece quando existe, e aí aparece em vermelho. "0 dias vencidos"
            seria ruído; 210 dias vencidos escondidos atrás de "0 a vencer" era
            o resumo afirmando que estava tudo em dia. */}
        {ferias.diasVencidos > 0 && (
          <KpiCard
            label="Dias já vencidos"
            valor={ferias.diasVencidos}
            icon={<AlertTriangle size={18} />}
            color="var(--accent-red)"
            index={1}
            hint="Já passaram do prazo de gozo — a empresa deve pagá-los em dobro"
          />
        )}
        <KpiCard
          label={ferias.vencendo === 1 ? "Período a vencer" : "Períodos a vencer"}
          valor={ferias.vencendo}
          icon={<Clock size={18} />}
          color={ferias.vencendo > 0 ? "var(--accent-amber)" : undefined}
          index={2}
          hint="Vencem em breve — ainda dá tempo de programar"
        />
        <KpiCard
          label="Documentos entregues"
          valor={documentos.total}
          icon={<FileText size={18} />}
          index={3}
        />
        <KpiCard
          label="Pendências minhas"
          valor={pendencias.length}
          icon={<ClipboardList size={18} />}
          color={atrasadas.length > 0 ? "var(--accent-red)" : undefined}
          index={4}
        />
      </KpiGrid>

      {/* As pendências vêm ANTES do cadastro: são o motivo de a tela existir. */}
      <Panel title="O que depende de mim">
        {pendencias.length === 0 ? (
          <Vazio
            icon={<CheckCircle2 size={28} />}
            titulo="Nada pendente"
            dica="Quando o RH ou seu gestor abrirem algo que dependa de você, aparece aqui."
          />
        ) : (
          <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {[...pendencias]
              // Atrasado primeiro, e dentro dele o que venceu há mais tempo.
              .sort((a, b) => (a.diasParaPrazo ?? 9999) - (b.diasParaPrazo ?? 9999))
              .map(p => (
                <li key={p.id} className="row-line">
                  <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    {p.situacao === "atrasado"
                      ? <AlertTriangle size={15} style={{ color: "var(--accent-red)", flexShrink: 0 }} />
                      : <Clock size={15} className="muted" style={{ flexShrink: 0 }} />}
                    <span style={{ minWidth: 0 }}>
                      <strong>{p.titulo}</strong>
                      <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                        {p.evento === "admissao" ? "admissão" : "desligamento"}
                      </span>
                    </span>
                  </span>
                  <StatusBadge
                    label={rotuloPrazo(p.situacao, p.diasParaPrazo)}
                    tone={p.situacao === "atrasado" ? "critico" : "neutro"}
                  />
                </li>
              ))}
          </ul>
        )}
      </Panel>

      {documentos.rejeitados > 0 && (
        <Panel title="Atenção">
          <p>
            {documentos.rejeitados === 1
              ? "Um documento seu foi rejeitado e precisa ser reenviado."
              : `${documentos.rejeitados} documentos seus foram rejeitados e precisam ser reenviados.`}
          </p>
          <button type="button" className="btn-secondary" onClick={() => onIrPara("documentos")}>
            Ver documentos
          </button>
        </Panel>
      )}

      {carreira?.trilha && (
        <Panel title="Carreira" actions={
          <button type="button" className="btn-secondary" onClick={() => onIrPara("carreira")}>
            Ver o que falta
          </button>
        }>
          <p>
            Trilha <strong>{carreira.trilha}</strong>
            {carreira.proximoCargo && <> — próximo degrau: <strong>{carreira.proximoCargo}</strong></>}
          </p>
          {carreira.percentual != null && (
            <p className="muted" style={{ fontSize: 13 }}>
              {carreira.percentual}% dos requisitos atendidos.
            </p>
          )}
        </Panel>
      )}

      <Panel title="Meu cadastro">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          <Campo rotulo="Matrícula" valor={colaborador.matricula ?? "—"} />
          <Campo rotulo="Cargo" valor={colaborador.cargo ?? "—"} />
          <Campo rotulo="Setor" valor={colaborador.setor ?? "—"} />
          <Campo rotulo="Gestor" valor={colaborador.gestor ?? "—"} />
          <Campo rotulo="Admissão" valor={colaborador.dataAdmissao ? formatarDataBR(colaborador.dataAdmissao) : "—"} />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Algo errado aqui? Fale com o RH — a correção do cadastro é feita por lá.
        </p>
      </Panel>
    </>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="mono-cap muted" style={{ fontSize: 11 }}>{rotulo}</div>
      <div>{valor}</div>
    </div>
  );
}

function primeiroNome(nome?: string | null): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "você";
}

function rotuloPrazo(situacao: string, dias: number | null): string {
  if (situacao === "concluido") return "concluído";
  if (dias === null) return "sem prazo";
  if (dias < 0) return `${Math.abs(dias)} ${Math.abs(dias) === 1 ? "dia" : "dias"} de atraso`;
  if (dias === 0) return "vence hoje";
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}
