"use client";

import { useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { useBenefits } from "@/hooks/usePeopleExtras";
import {
  benefitsService, Beneficio, Concessao, CATEGORIAS_BENEFICIO,
} from "@/lib/people/benefits.service";
import {
  Panel, TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  StatusBadge, RowActions, RowAction, Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Plus, Gift, Ban } from "lucide-react";

/**
 * Benefícios do colaborador.
 *
 * A concessão encerrada continua na lista, esmaecida. Sumir com ela daria a
 * impressão de que nunca existiu — e é justamente o histórico que folha e
 * rescisão precisam consultar.
 */

const fmtData = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const fmtMoeda = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * `string` e não a união de categorias: a concessão traz `benefit.categoria`
 * como texto do banco, e um valor gravado antes de a lista atual existir tem
 * de cair no próprio nome, não quebrar a tipagem.
 */
const ROTULO_CATEGORIA = new Map<string, string>(
  CATEGORIAS_BENEFICIO.map(c => [c.value as string, c.label]),
);

type Props = {
  collaboratorId: string;
  podeGerenciar: boolean;
};

export default function AbaBeneficios({ collaboratorId, podeGerenciar }: Props) {
  const { dados, carregando, erro, semPermissao, recarregar } = useBenefits(collaboratorId);
  const [concedendo, setConcedendo] = useState(false);
  const [encerrando, setEncerrando] = useState<Concessao | null>(null);

  if (semPermissao) {
    return <PermissionDenied hint="Você não tem permissão para ver os benefícios deste colaborador." />;
  }

  const COLUNAS = ["Benefício", "Categoria", "Início", "Fim", "Valor", "Situação", ""];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {!carregando && dados.itens.length > 0 && (
          <div
            style={{
              padding: "14px 18px", borderRadius: 14, alignSelf: "flex-start", minWidth: 190,
              background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="mono-cap" style={{ color: "var(--text-muted)", marginBottom: 6 }}>
              Custo mensal vigente
            </div>
            <span className="metric" style={{ fontSize: 22, fontWeight: 600 }}>
              {fmtMoeda(dados.custoMensalVigente)}
            </span>
          </div>
        )}

        <Panel
          title={`BENEFÍCIOS (${dados.itens.length})`}
          actions={
            podeGerenciar && (
              <button type="button" className="btn btn-ghost" onClick={() => setConcedendo(true)}>
                <Plus size={13} /> Conceder
              </button>
            )
          }
        >
          <TableCard>
            <thead>
              <tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {carregando ? (
                <LoadingRows colSpan={COLUNAS.length} rows={3} />
              ) : erro ? (
                <ErrorState detail={erro} onRetry={recarregar} colSpan={COLUNAS.length} />
              ) : dados.itens.length === 0 ? (
                <EmptyState
                  colSpan={COLUNAS.length}
                  icon={<Gift size={20} />}
                  title="Nenhum benefício concedido"
                  hint={podeGerenciar ? "Conceda benefícios do catálogo da organização." : undefined}
                />
              ) : (
                dados.itens.map(c => (
                  <tr key={c.id} style={{ opacity: c.vigente ? 1 : 0.55 }}>
                    <td style={{ fontWeight: 600 }}>{c.benefit.nome}</td>
                    {/* Mesmo rótulo de Catálogos: a categoria crua ("saude")
                        aparecia aqui enquanto lá aparecia "Saúde" — a mesma
                        informação com dois nomes em duas telas. */}
                    <td>{ROTULO_CATEGORIA.get(c.benefit.categoria) ?? c.benefit.categoria}</td>
                    <td className="num">{fmtData(c.inicio)}</td>
                    <td className="num">{fmtData(c.fim)}</td>
                    <td className="num">{fmtMoeda(c.valor)}</td>
                    <td>
                      <StatusBadge
                        label={c.vigente ? "Vigente" : "Encerrado"}
                        tone={c.vigente ? "ok" : "neutro"}
                      />
                    </td>
                    <td>
                      {podeGerenciar && c.vigente && (
                        <RowActions>
                          <RowAction tone="danger" title="Encerrar" onClick={() => setEncerrando(c)}>
                            <Ban size={13} />
                          </RowAction>
                        </RowActions>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </TableCard>
        </Panel>
      </div>

      <ConcederBeneficio
        aberto={concedendo}
        collaboratorId={collaboratorId}
        onFechar={() => setConcedendo(false)}
        onConcedido={recarregar}
      />
      <EncerrarConcessao
        concessao={encerrando}
        onFechar={() => setEncerrando(null)}
        onEncerrado={recarregar}
      />
    </>
  );
}

function ConcederBeneficio({
  aberto, collaboratorId, onFechar, onConcedido,
}: {
  aberto: boolean; collaboratorId: string; onFechar: () => void; onConcedido: () => void;
}) {
  const [catalogo, setCatalogo] = useState<Beneficio[]>([]);
  const [benefitId, setBenefitId] = useState("");
  const [inicio, setInicio] = useState("");
  const [valor, setValor] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setBenefitId(""); setInicio(""); setValor(""); setObservacoes(""); setErros({});
    benefitsService.catalogo()
      .then(r => setCatalogo(r.data ?? []))
      .catch(() => setCatalogo([]));
  }, [aberto]);

  const escolhido = catalogo.find(b => b.id === benefitId);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const novos: Record<string, string> = {};
    if (!benefitId) novos.benefitId = "Escolha o benefício";
    if (!inicio) novos.inicio = "Informe a data de início";
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      await benefitsService.conceder(collaboratorId, {
        benefitId,
        inicio,
        valor: valor === "" ? undefined : Number(valor),
        observacoes,
      });
      useToastStore.getState().success("Benefício concedido");
      onConcedido();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErros({ inicio: Array.isArray(msg) ? msg.join(". ") : msg });
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal aberto={aberto} titulo="Conceder benefício" onFechar={onFechar} largura={520}>
      <form onSubmit={salvar} noValidate>
        <FormGrid>
          <FormField label="Benefício" obrigatorio erro={erros.benefitId} largura="total">
            <select className="input-o" value={benefitId} onChange={e => setBenefitId(e.target.value)}>
              <option value="">—</option>
              {catalogo.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          </FormField>

          <FormField label="Início" obrigatorio erro={erros.inicio}>
            <input type="date" className="input-o" value={inicio} onChange={e => setInicio(e.target.value)} />
          </FormField>

          <FormField
            label="Valor mensal"
            dica={
              escolhido?.valorReferencia != null
                ? `Em branco usa a referência: ${escolhido.valorReferencia.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
                : "Opcional"
            }
          >
            <input
              type="number" className="input-o" min={0} step="0.01"
              value={valor} onChange={e => setValor(e.target.value)}
              placeholder={escolhido?.valorReferencia?.toString() ?? ""}
            />
          </FormField>

          <FormField label="Observações" largura="total">
            <textarea
              className="input-o" rows={2} maxLength={500}
              value={observacoes} onChange={e => setObservacoes(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Concedendo..." : "Conceder"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}

function EncerrarConcessao({
  concessao, onFechar, onEncerrado,
}: {
  concessao: Concessao | null; onFechar: () => void; onEncerrado: () => void;
}) {
  const [fim, setFim] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!concessao) return;
    setFim(new Date().toISOString().slice(0, 10));
    setErro("");
  }, [concessao]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!concessao || !fim) { setErro("Informe a data de encerramento"); return; }

    setSalvando(true);
    try {
      await benefitsService.encerrar(concessao.id, fim);
      useToastStore.getState().success("Benefício encerrado");
      onEncerrado();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        setErro(Array.isArray(msg) ? msg.join(". ") : msg);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={!!concessao}
      titulo="Encerrar benefício"
      subtitulo={concessao?.benefit.nome}
      onFechar={onFechar}
      largura={430}
    >
      <form onSubmit={salvar} noValidate>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 0 }}>
          A concessão continua no histórico com a data de encerramento — nada é
          apagado. Depois disso é possível conceder o mesmo benefício de novo.
        </p>

        <FormGrid>
          <FormField label="Encerrar em" obrigatorio erro={erro} largura="total">
            <input type="date" className="input-o" value={fim} onChange={e => setFim(e.target.value)} />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Encerrando..." : "Encerrar"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
