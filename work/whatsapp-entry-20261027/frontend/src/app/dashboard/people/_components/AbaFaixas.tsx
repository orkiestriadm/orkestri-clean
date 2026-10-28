"use client";

import { useCallback, useEffect, useState } from "react";
import { useToastStore } from "@/lib/toast";
import { salaryService, FaixaCargo } from "@/lib/people/salary.service";
import {
  TableCard, EmptyState, LoadingRows, ErrorState, PermissionDenied,
  RowActions, RowAction, Modal, FormGrid, FormField, FormActions,
} from "@/components/data-ui";
import { Coins, Pencil } from "lucide-react";

/**
 * Faixa salarial por cargo.
 *
 * Vive numa aba própria e sob `people.salario:*` porque não é catálogo: quem
 * organiza os cargos não decide quanto cada um vale. Sem esta tela a faixa só
 * existia no banco — e é ela que faz o alerta de "fora da faixa" no painel de
 * remuneração funcionar; cargo sem faixa é cargo que nunca dispara alerta.
 */

const fmtMoeda = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Props = {
  podeGerenciar: boolean;
};

export default function AbaFaixas({ podeGerenciar }: Props) {
  const [itens, setItens] = useState<FaixaCargo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [semPermissao, setSemPermissao] = useState(false);
  const [editando, setEditando] = useState<FaixaCargo | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await salaryService.faixas();
      setItens(r.data ?? []);
      setSemPermissao(false);
    } catch (e: any) {
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message ?? "Não foi possível carregar as faixas");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (semPermissao) {
    return <PermissionDenied hint="Faixa salarial exige a permissão de remuneração." />;
  }

  const semFaixa = itens.filter(c => !c.definida);
  const COLUNAS = ["Cargo", "Nível", "Colaboradores", "Mínimo", "Médio", "Máximo", "Amplitude", ""];

  return (
    <>
      {!carregando && semFaixa.length > 0 && (
        <div
          style={{
            padding: "13px 16px", borderRadius: 14, marginBottom: 14,
            fontSize: 12, lineHeight: 1.55, color: "var(--text-secondary)",
            background: "color-mix(in srgb, var(--accent-amber) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent-amber) 24%, transparent)",
          }}
        >
          <span className="metric" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
            {semFaixa.length}
          </span>{" "}
          {semFaixa.length === 1 ? "cargo sem faixa definida" : "cargos sem faixa definida"}.
          Enquanto a faixa não existe, ninguém nesses cargos aparece como fora da faixa
          no painel de remuneração — o alerta fica cego, não silencioso.
        </div>
      )}

      <TableCard>
        <thead>
          <tr>{COLUNAS.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {carregando ? (
            <LoadingRows colSpan={COLUNAS.length} rows={4} />
          ) : erro ? (
            <ErrorState detail={erro} onRetry={carregar} colSpan={COLUNAS.length} />
          ) : itens.length === 0 ? (
            <EmptyState
              colSpan={COLUNAS.length}
              icon={<Coins size={20} />}
              title="Nenhum cargo ativo no catálogo"
              hint="Crie os cargos na aba Cargos para depois definir a faixa de cada um."
            />
          ) : (
            itens.map(c => {
              // Amplitude só faz sentido com as duas pontas; com uma só, o número
              // seria o próprio valor e pareceria uma faixa que não existe.
              const amplitude =
                c.minimo !== null && c.maximo !== null && c.minimo > 0
                  ? `${Math.round(((c.maximo - c.minimo) / c.minimo) * 100)}%`
                  : "—";

              return (
                <tr key={c.id} style={{ opacity: c.definida ? 1 : 0.72 }}>
                  <td style={{ fontWeight: 600 }}>{c.titulo}</td>
                  <td>{c.nivel || "—"}</td>
                  <td className="num">{c.colaboradores}</td>
                  <td className="num">{fmtMoeda(c.minimo)}</td>
                  <td className="num">{fmtMoeda(c.medio)}</td>
                  <td className="num">{fmtMoeda(c.maximo)}</td>
                  <td className="num">{amplitude}</td>
                  <td>
                    {podeGerenciar && (
                      <RowActions>
                        <RowAction tone="view" title="Definir faixa" onClick={() => setEditando(c)}>
                          <Pencil size={13} />
                        </RowAction>
                      </RowActions>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableCard>

      <FaixaForm
        cargo={editando}
        onFechar={() => setEditando(null)}
        onSalvo={carregar}
      />
    </>
  );
}

function FaixaForm({
  cargo, onFechar, onSalvo,
}: {
  cargo: FaixaCargo | null; onFechar: () => void; onSalvo: () => void;
}) {
  const [minimo, setMinimo] = useState("");
  const [medio, setMedio] = useState("");
  const [maximo, setMaximo] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!cargo) return;
    setMinimo(cargo.minimo === null ? "" : String(cargo.minimo));
    setMedio(cargo.medio === null ? "" : String(cargo.medio));
    setMaximo(cargo.maximo === null ? "" : String(cargo.maximo));
    setErro("");
  }, [cargo]);

  /** Vazio é `null` — apagar o campo limpa a faixa, não manda zero. */
  const numero = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!cargo) return;

    const faixa = { minimo: numero(minimo), medio: numero(medio), maximo: numero(maximo) };
    if (Object.values(faixa).some(v => v !== null && (Number.isNaN(v) || v < 0))) {
      setErro("Valor inválido");
      return;
    }
    // Mesma regra do backend, verificada aqui para o erro aparecer antes do
    // envio: incoerência de faixa é erro de digitação, não de servidor.
    const { minimo: mi, medio: me, maximo: ma } = faixa;
    if (mi !== null && ma !== null && mi > ma) {
      setErro("O mínimo não pode ser maior que o máximo.");
      return;
    }
    if (me !== null && ((mi !== null && me < mi) || (ma !== null && me > ma))) {
      setErro("O médio precisa ficar entre o mínimo e o máximo.");
      return;
    }

    setSalvando(true);
    try {
      await salaryService.definirFaixa(cargo.id, faixa);
      useToastStore.getState().success(
        mi === null && me === null && ma === null ? "Faixa removida" : "Faixa definida",
      );
      onSalvo();
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
      aberto={!!cargo}
      titulo="Faixa salarial"
      subtitulo={cargo?.titulo}
      onFechar={onFechar}
      largura={520}
    >
      <form onSubmit={salvar} noValidate>
        <p style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 0 }}>
          A faixa é o que permite dizer se um salário está abaixo ou acima do
          previsto para o cargo. Os três campos são opcionais — deixar em branco
          apaga o valor.
        </p>

        <FormGrid>
          <FormField label="Mínimo">
            <input
              type="number" className="input-o" min={0} step="0.01"
              value={minimo} onChange={e => setMinimo(e.target.value)} placeholder="—"
            />
          </FormField>
          <FormField label="Médio" dica="Referência de mercado para o cargo">
            <input
              type="number" className="input-o" min={0} step="0.01"
              value={medio} onChange={e => setMedio(e.target.value)} placeholder="—"
            />
          </FormField>
          <FormField label="Máximo" erro={erro}>
            <input
              type="number" className="input-o" min={0} step="0.01"
              value={maximo} onChange={e => setMaximo(e.target.value)} placeholder="—"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar faixa"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
