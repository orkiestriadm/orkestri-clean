"use client";
export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import { useEmployee } from "@/hooks/useEmployees";
import { ColaboradorDetalhe, EventoHistorico, StatusColaborador } from "@/lib/people/employees.service";
import {
  PageBody, BackLink, Tabs, DetailHeader, Panel, FieldGrid, Field,
  Timeline, TimelineItem, StatusBadge, BadgeTone,
  ErrorState, PermissionDenied, TableCard,
} from "@/components/data-ui";
import { UserX, Mail, Phone, Building2, Pencil, RefreshCw } from "lucide-react";
import { useAuthStore } from "@/lib/store";
import ColaboradorForm from "../_components/ColaboradorForm";
import MudarSituacao from "../_components/MudarSituacao";
import AbaDocumentos from "../_components/AbaDocumentos";
import AbaFerias from "../_components/AbaFerias";
import AbaBeneficios from "../_components/AbaBeneficios";
import AbaDesenvolvimento from "../_components/AbaDesenvolvimento";
import AbaCompetencias from "../_components/AbaCompetencias";
import AbaRemuneracao from "../_components/AbaRemuneracao";
import SecaoFeedback from "../_components/SecaoFeedback";
import AbaAusenciasPerfil from "../_components/AbaAusenciasPerfil";

/**
 * Perfil 360 do colaborador.
 *
 * DETAIL_PAGE_BLUEPRINT.md e PEOPLE_HUB_BLUEPRINT.md §8: o perfil é o espaço de
 * trabalho central — nove abas cobrindo o ciclo inteiro, de dados pessoais a
 * desempenho.
 *
 * Cada aba checa a própria permissão em vez de sumir da lista: uma aba que
 * desaparece faz o usuário achar que o recurso não existe, enquanto uma que
 * diz "sem permissão" ensina o que pedir ao administrador.
 */

const SITUACAO: Record<StatusColaborador, { label: string; tone: BadgeTone }> = {
  ATIVO:     { label: "Ativo",     tone: "ok" },
  AFASTADO:  { label: "Afastado",  tone: "atencao" },
  SUSPENSO:  { label: "Suspenso",  tone: "atencao" },
  INATIVO:   { label: "Inativo",   tone: "neutro" },
  DESLIGADO: { label: "Desligado", tone: "critico" },
};

const ROTULO_EVENTO: Record<string, { titulo: string; tone: BadgeTone }> = {
  admissao:       { titulo: "Admissão",            tone: "ok" },
  mudanca_setor:  { titulo: "Mudança de setor",    tone: "info" },
  mudanca_cargo:  { titulo: "Mudança de cargo",    tone: "info" },
  mudanca_gestor: { titulo: "Mudança de gestor",   tone: "info" },
  mudanca_status: { titulo: "Mudança de situação", tone: "atencao" },
  promocao:       { titulo: "Promoção",            tone: "ok" },
  desligamento:   { titulo: "Desligamento",        tone: "critico" },
  outro:          { titulo: "Registro",            tone: "neutro" },
};

type Aba =
  | "visao" | "pessoal" | "vinculo" | "documentos" | "ferias"
  | "beneficios" | "remuneracao" | "ausencias" | "desenvolvimento" | "competencias"
  | "equipe" | "historico";

const ABAS: { id: Aba; label: string }[] = [
  { id: "visao",      label: "Visão geral" },
  { id: "pessoal",    label: "Dados pessoais" },
  { id: "vinculo",    label: "Vínculo" },
  { id: "documentos", label: "Documentos" },
  { id: "ferias",     label: "Férias" },
  { id: "ausencias",  label: "Ausências" },
  { id: "beneficios", label: "Benefícios" },
  { id: "remuneracao", label: "Remuneração" },
  { id: "desenvolvimento", label: "Desenvolvimento" },
  { id: "competencias", label: "Competências" },
  { id: "equipe",     label: "Equipe" },
  { id: "historico",  label: "Histórico" },
];

const fmtData = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;

const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();

/** Tempo de casa em texto — mais legível que a data crua no cabeçalho. */
function tempoDeCasa(admissao: string | null): string | null {
  if (!admissao) return null;
  const meses = Math.floor((Date.now() - new Date(admissao).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (meses < 1) return "menos de um mês";
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const parteAnos = `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return resto === 0 ? parteAnos : `${parteAnos} e ${resto} ${resto === 1 ? "mês" : "meses"}`;
}

/** Espelha o backend só para não oferecer ação que vai falhar. */
function pode(user: any, ...perms: string[]): boolean {
  if (user?.isMaster) return true;
  const atuais: string[] = user?.permissions ?? [];
  return atuais.includes("*") || perms.some(p => atuais.includes(p));
}

export default function PerfilColaboradorPage() {
  const params = useParams();
  const router = useRouter();
  const user = useAuthStore(s => s.user);
  const id = typeof params?.id === "string" ? params.id : null;
  const [aba, setAba] = useState<Aba>("visao");
  const [editando, setEditando] = useState(false);
  const [mudandoSituacao, setMudandoSituacao] = useState(false);

  const { colaborador, historico, carregando, erro, semPermissao, naoEncontrado, recarregar } = useEmployee(id);

  const podeEditar = pode(user, "people.colaborador:editar", "colaboradores:editar");
  const podeMudarSituacao = pode(user, "people.colaborador:mudar_situacao", "colaboradores:editar");
  // Documentos têm concessão própria: nenhuma permissão legada os alcança.
  const podeEnviarDoc = pode(user, "people.documento:enviar");
  const podeAprovarDoc = pode(user, "people.documento:aprovar");
  const podeExcluirDoc = pode(user, "people.documento:excluir");
  const podeSolicitarFerias = pode(user, "people.ferias:solicitar");
  const podeGerenciarBeneficio = pode(user, "people.beneficio:gerenciar");
  const podeGerenciarTreinamento = pode(user, "people.treinamento:gerenciar");
  const podeVerAvaliacao = pode(user, "people.avaliacao:ver", "people.avaliacao:gerenciar");
  const podeGerenciarAvaliacao = pode(user, "people.avaliacao:gerenciar");
  // Salario e o dado mais sensivel: nenhuma permissao legada o alcanca.
  const podeVerSalario = pode(user, "people.salario:ver", "people.salario:gerenciar");
  const podeGerenciarSalario = pode(user, "people.salario:gerenciar");
  const podeRegistrarFeedback = pode(user, "people.feedback:registrar");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Topbar />
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PageBody>
          <BackLink href="/dashboard/people" label="Colaboradores" />

          {carregando ? (
            <Esqueleto />
          ) : semPermissao ? (
            <PermissionDenied hint="Você não tem permissão para ver o perfil deste colaborador." />
          ) : naoEncontrado ? (
            // O backend devolve 404 tanto para inexistente quanto para fora de
            // escopo — revelar a diferença já seria vazamento de informação.
            <EmptyStateSolto
              titulo="Colaborador não encontrado"
              dica="O registro pode ter sido excluído, ou está fora do seu escopo de acesso."
              onVoltar={() => router.push("/dashboard/people")}
            />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={recarregar} />
          ) : colaborador ? (
            <>
              <Cabecalho
                colaborador={colaborador}
                acoes={
                  <>
                    {podeMudarSituacao && (
                      <button type="button" className="btn btn-ghost" onClick={() => setMudandoSituacao(true)}>
                        <RefreshCw size={13} /> Mudar situação
                      </button>
                    )}
                    {podeEditar && (
                      <button type="button" className="btn btn-primary" onClick={() => setEditando(true)}>
                        <Pencil size={13} /> Editar
                      </button>
                    )}
                  </>
                }
              />
              <Tabs<Aba> tabs={ABAS} active={aba} onChange={setAba} />
              {aba === "visao"     && <AbaVisao colaborador={colaborador} historico={historico} />}
              {aba === "pessoal"   && <AbaPessoal colaborador={colaborador} />}
              {aba === "vinculo"   && <AbaVinculo colaborador={colaborador} />}
              {aba === "documentos" && (
                <AbaDocumentos
                  collaboratorId={colaborador.id}
                  podeEnviar={podeEnviarDoc}
                  podeAprovar={podeAprovarDoc}
                  podeExcluir={podeExcluirDoc}
                />
              )}
              {aba === "ferias" && (
                <AbaFerias
                  collaboratorId={colaborador.id}
                  nome={colaborador.nomeExibicao}
                  podeSolicitar={podeSolicitarFerias && colaborador.status === "ATIVO"}
                />
              )}
              {aba === "beneficios" && (
                <AbaBeneficios
                  collaboratorId={colaborador.id}
                  podeGerenciar={podeGerenciarBeneficio}
                />
              )}
              {aba === "ausencias" && (
                <AbaAusenciasPerfil
                  collaboratorId={colaborador.id}
                  userId={colaborador.userId ?? null}
                />
              )}
              {aba === "remuneracao" && (
                podeVerSalario ? (
                  <AbaRemuneracao
                    collaboratorId={colaborador.id}
                    podeGerenciar={podeGerenciarSalario}
                  />
                ) : (
                  <PermissionDenied hint="Você não tem permissão para ver a remuneração deste colaborador." />
                )
              )}
              {aba === "desenvolvimento" && (
                <AbaDesenvolvimento
                  collaboratorId={colaborador.id}
                  podeGerenciarTreinamento={podeGerenciarTreinamento}
                  podeVerAvaliacao={podeVerAvaliacao}
                  podeGerenciarAvaliacao={podeGerenciarAvaliacao}
                />
              )}
              {aba === "desenvolvimento" && (
                <div style={{ marginTop: 16 }}>
                  <SecaoFeedback
                    collaboratorId={colaborador.id}
                    podeRegistrar={podeRegistrarFeedback}
                  />
                </div>
              )}
              {aba === "competencias" && (
                <AbaCompetencias
                  collaboratorId={colaborador.id}
                  podeGerenciar={podeEditar}
                />
              )}
              {aba === "equipe"    && <AbaEquipe colaborador={colaborador} />}
              {aba === "historico" && <AbaHistorico historico={historico} />}

              <ColaboradorForm
                aberto={editando}
                colaborador={colaborador}
                onFechar={() => setEditando(false)}
                onSalvo={recarregar}
              />
              <MudarSituacao
                aberto={mudandoSituacao}
                colaborador={colaborador}
                onFechar={() => setMudandoSituacao(false)}
                onMudou={recarregar}
              />
            </>
          ) : null}
        </PageBody>
      </div>
    </div>
  );
}

function Cabecalho({ colaborador, acoes }: { colaborador: ColaboradorDetalhe; acoes?: React.ReactNode }) {
  const situacao = SITUACAO[colaborador.status] ?? SITUACAO.INATIVO;
  const cargo = colaborador.position?.titulo || colaborador.cargo;
  const tempo = tempoDeCasa(colaborador.dataAdmissao);

  return (
    <DetailHeader
      avatar={
        colaborador.fotoUrl
          ? <img src={colaborador.fotoUrl} alt="" />
          : <span>{iniciais(colaborador.nomeExibicao)}</span>
      }
      titulo={colaborador.nomeExibicao}
      selo={<StatusBadge label={situacao.label} tone={situacao.tone} />}
      subtitulo={[cargo, colaborador.setor?.nome].filter(Boolean).join(" · ") || undefined}
      meta={
        <>
          {colaborador.matricula && <span className="num">Matrícula {colaborador.matricula}</span>}
          {tempo && <span>{tempo} de casa</span>}
          {!colaborador.userId && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--accent-amber)" }}>
              <UserX size={11} /> sem acesso ao sistema
            </span>
          )}
        </>
      }
      actions={acoes}
    />
  );
}

function AbaVisao({ colaborador, historico }: { colaborador: ColaboradorDetalhe; historico: EventoHistorico[] }) {
  const contatoEmergencia = colaborador.contatos?.find(c => c.emergencia);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(260px, 1fr)", gap: 16, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Panel title="CONTATO">
          <FieldGrid>
            <Field label="E-mail corporativo" value={colaborador.emailCorporativo} />
            <Field label="Telefone" value={colaborador.telefone} />
            <Field label="Celular" value={colaborador.celular} />
          </FieldGrid>
        </Panel>

        <Panel title="POSIÇÃO">
          <FieldGrid>
            <Field label="Cargo" value={colaborador.position?.titulo || colaborador.cargo} />
            <Field label="Setor" value={colaborador.setor?.nome} />
            <Field label="Gestor" value={colaborador.gestor?.nomeCompleto || colaborador.gestor?.user?.nome} />
            <Field label="Senioridade" value={colaborador.senioridade} />
            <Field label="Squad" value={colaborador.squad} />
            <Field label="Admissão" value={fmtData(colaborador.dataAdmissao)} />
          </FieldGrid>
        </Panel>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {contatoEmergencia && (
          <Panel title="CONTATO DE EMERGÊNCIA">
            <FieldGrid min={140}>
              <Field label="Nome" value={contatoEmergencia.nome} />
              <Field label="Parentesco" value={contatoEmergencia.parentesco} />
              <Field label="Telefone" value={contatoEmergencia.telefone} />
            </FieldGrid>
          </Panel>
        )}

        <Panel title="ÚLTIMOS EVENTOS">
          <Timeline itens={paraTimeline(historico).slice(0, 5)} />
        </Panel>
      </div>
    </div>
  );
}

function AbaPessoal({ colaborador }: { colaborador: ColaboradorDetalhe }) {
  const endereco = colaborador.enderecos?.find(e => e.principal) ?? colaborador.enderecos?.[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="IDENTIFICAÇÃO">
        <FieldGrid>
          <Field label="Nome completo" value={colaborador.nomeCompleto} />
          <Field label="Data de nascimento" value={fmtData(colaborador.dataNascimento)} />
          <Field label="Gênero" value={colaborador.genero} />
          <Field label="Estado civil" value={colaborador.estadoCivil} />
          <Field label="Nacionalidade" value={colaborador.nacionalidade} />
          <Field label="E-mail pessoal" value={colaborador.emailPessoal} />
        </FieldGrid>
      </Panel>

      <Panel title="ENDEREÇO">
        {endereco ? (
          <FieldGrid>
            <Field label="CEP" value={endereco.cep} />
            <Field label="Logradouro" value={[endereco.logradouro, endereco.numero].filter(Boolean).join(", ")} />
            <Field label="Complemento" value={endereco.complemento} />
            <Field label="Bairro" value={endereco.bairro} />
            <Field label="Cidade" value={[endereco.cidade, endereco.estado].filter(Boolean).join(" / ")} />
          </FieldGrid>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Nenhum endereço cadastrado.</p>
        )}
      </Panel>

      <Panel title="CONTATOS">
        {colaborador.contatos?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {colaborador.contatos.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nome}</div>
                  {c.parentesco && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.parentesco}</div>}
                </div>
                {c.telefone && <span style={{ fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center" }}><Phone size={12} />{c.telefone}</span>}
                {c.email && <span style={{ fontSize: 12.5, display: "inline-flex", gap: 5, alignItems: "center" }}><Mail size={12} />{c.email}</span>}
                {c.emergencia && <StatusBadge label="Emergência" tone="atencao" />}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Nenhum contato cadastrado.</p>
        )}
      </Panel>
    </div>
  );
}

function AbaVinculo({ colaborador }: { colaborador: ColaboradorDetalhe }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="CONTRATO">
        <FieldGrid>
          <Field label="Matrícula" value={colaborador.matricula} />
          <Field label="Tipo de vínculo" value={colaborador.tipoVinculo} />
          <Field label="Admissão" value={fmtData(colaborador.dataAdmissao)} />
          <Field label="Desligamento" value={fmtData(colaborador.dataDesligamento)} />
          <Field label="Situação" value={SITUACAO[colaborador.status]?.label} />
        </FieldGrid>
      </Panel>

      <Panel title="JORNADA">
        <FieldGrid>
          <Field label="Horas por dia" value={colaborador.jornadaHorasDia} />
          <Field label="Horas por mês" value={colaborador.jornadaHorasMes} />
          <Field label="Turno" value={colaborador.turno} />
          <Field label="Escala" value={colaborador.escala} />
        </FieldGrid>
      </Panel>

      <Panel title="ACESSO AO SISTEMA">
        {colaborador.user ? (
          <FieldGrid>
            <Field label="Usuário" value={colaborador.user.nome} />
            <Field label="E-mail de login" value={colaborador.user.email} />
            <Field
              label="Conta"
              value={<StatusBadge label={colaborador.user.ativo ? "Ativa" : "Inativa"} tone={colaborador.user.ativo ? "ok" : "neutro"} />}
            />
          </FieldGrid>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <UserX size={16} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
              Este colaborador não tem acesso ao sistema. Ele aparece no quadro e
              nos relatórios de pessoas, mas não aponta horas — por isso a
              utilização de capacidade dele fica em zero.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}

function AbaEquipe({ colaborador }: { colaborador: ColaboradorDetalhe }) {
  const gestor = colaborador.gestor?.nomeCompleto || colaborador.gestor?.user?.nome;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel title="REPORTA A">
        {gestor ? (
          <Link
            href={`/dashboard/people/${colaborador.gestor!.id}`}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--accent-violet)", textDecoration: "none" }}
          >
            <Building2 size={13} /> {gestor}
          </Link>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Sem gestor definido.</p>
        )}
      </Panel>

      <Panel title={`LIDERADOS DIRETOS (${colaborador.liderados?.length ?? 0})`}>
        {colaborador.liderados?.length ? (
          <TableCard>
            <thead>
              <tr><th>Colaborador</th><th>Cargo</th></tr>
            </thead>
            <tbody>
              {colaborador.liderados.map(l => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/dashboard/people/${l.id}`} style={{ color: "var(--accent-violet)", textDecoration: "none" }}>
                      {l.nomeCompleto || l.user?.nome || "—"}
                    </Link>
                  </td>
                  <td>{l.cargo || "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>Nenhum liderado direto.</p>
        )}
      </Panel>
    </div>
  );
}

function AbaHistorico({ historico }: { historico: EventoHistorico[] }) {
  return (
    <Panel title="LINHA DO TEMPO FUNCIONAL">
      <Timeline itens={paraTimeline(historico)} />
    </Panel>
  );
}

function paraTimeline(historico: EventoHistorico[]): TimelineItem[] {
  return historico.map(e => {
    const rotulo = ROTULO_EVENTO[e.evento] ?? ROTULO_EVENTO.outro;
    return {
      id: e.id,
      titulo: rotulo.titulo,
      descricao: e.descricao,
      data: e.registradoEm,
      tone: rotulo.tone,
    };
  });
}

function Esqueleto() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span className="skeleton" style={{ width: 58, height: 58, borderRadius: 18 }} />
        <div style={{ flex: 1 }}>
          <span className="skeleton" style={{ display: "block", height: 18, width: "36%", marginBottom: 8 }} />
          <span className="skeleton" style={{ display: "block", height: 12, width: "22%" }} />
        </div>
      </div>
      <span className="skeleton" style={{ display: "block", height: 160, borderRadius: 16 }} />
    </div>
  );
}

function EmptyStateSolto({ titulo, dica, onVoltar }: { titulo: string; dica: string; onVoltar: () => void }) {
  return (
    <div className="state-block">
      <span className="state-block__icon"><UserX size={20} /></span>
      <span className="state-block__title">{titulo}</span>
      <span className="state-block__hint">{dica}</span>
      <button type="button" className="state-block__action" onClick={onVoltar}>
        Voltar para a lista
      </button>
    </div>
  );
}
