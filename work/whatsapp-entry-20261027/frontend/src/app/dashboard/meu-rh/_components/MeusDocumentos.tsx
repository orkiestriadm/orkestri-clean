"use client";

import { useCallback, useEffect, useState } from "react";
import { meService } from "@/lib/people/me.service";
import {
  Documento, CategoriaDocumento, MIMES_ACEITOS, TAMANHO_MAXIMO_BYTES,
} from "@/lib/people/documents.service";
import { Panel, StatusBadge, ErrorState, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { useToastStore } from "@/lib/toast";
import { formatarDataBR } from "@/lib/datas";
import { FileText, AlertTriangle } from "lucide-react";
import Vazio from "./Vazio";

/**
 * Meus documentos — o que entreguei e o que falta reenviar.
 *
 * O documento REJEITADO abre a lista, com o motivo à vista. É o único item
 * desta tela que exige ação, e enterrá-lo em ordem cronológica faria a pessoa
 * descobrir a rejeição só quando alguém cobrasse.
 *
 * Não há botão de excluir: documento entregue ao RH é registro da relação de
 * trabalho, e apagar do próprio lado não é uma decisão do colaborador.
 */

const CATEGORIAS: { value: CategoriaDocumento; label: string }[] = [
  { value: "identidade",  label: "Identidade" },
  { value: "contrato",    label: "Contrato" },
  { value: "certificado", label: "Certificado" },
  { value: "medico",      label: "Médico" },
  { value: "formacao",    label: "Formação" },
  { value: "outro",       label: "Outro" },
];

const TOM_APROVACAO: Record<string, "ok" | "neutro" | "atencao" | "critico"> = {
  APROVADO: "ok",
  PENDENTE: "atencao",
  REJEITADO: "critico",
  ARQUIVADO: "neutro",
};

const ROTULO_APROVACAO: Record<string, string> = {
  APROVADO: "Aprovado",
  PENDENTE: "Em conferência",
  REJEITADO: "Rejeitado",
  ARQUIVADO: "Arquivado",
};

export default function MeusDocumentos({ onAlterou }: { onAlterou: () => void }) {
  const [itens, setItens] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const r = await meService.documentos();
      setItens(r.data ?? []);
    } catch (e: any) {
      setErro(e?.response?.data?.message ?? "Não foi possível carregar os seus documentos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  if (erro) return <ErrorState detail={erro} onRetry={carregar} />;
  if (carregando) return <Panel><p className="muted">Carregando…</p></Panel>;

  // Rejeitado primeiro: é o único que exige ação de quem está lendo.
  const ordenados = [...itens].sort((a, b) => {
    const peso = (d: Documento) => (d.aprovacao === "REJEITADO" ? 0 : d.aprovacao === "PENDENTE" ? 1 : 2);
    return peso(a) - peso(b) || (b.criadoEm ?? "").localeCompare(a.criadoEm ?? "");
  });

  return (
    <>
      <Enviar onEnviou={() => { carregar(); onAlterou(); }} />

      <Panel title="Meus documentos">
        {ordenados.length === 0 ? (
          <Vazio
            icon={<FileText size={28} />}
            titulo="Nenhum documento entregue"
            dica="Use o formulário acima para enviar o primeiro."
          />
        ) : (
          <ul style={{ display: "grid", gap: 8, listStyle: "none", padding: 0, margin: 0 }}>
            {ordenados.map(d => (
              <li key={d.id} className="row-line">
                <span style={{ minWidth: 0 }}>
                  <strong>{d.titulo}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Enviado em {formatarDataBR(d.criadoEm)}
                    {d.dataValidade && <> · válido até {formatarDataBR(d.dataValidade)}</>}
                  </div>
                  {d.aprovacao === "REJEITADO" && d.motivoRejeicao && (
                    <div style={{ display: "flex", gap: 6, marginTop: 4, color: "var(--accent-red)", fontSize: 13 }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                      <span>{d.motivoRejeicao} — envie novamente.</span>
                    </div>
                  )}
                  {d.situacaoValidade === "vencido" && (
                    <div className="muted" style={{ fontSize: 12, color: "var(--accent-red)" }}>
                      A validade deste documento já passou.
                    </div>
                  )}
                </span>
                <StatusBadge
                  label={ROTULO_APROVACAO[d.aprovacao] ?? d.aprovacao}
                  tone={TOM_APROVACAO[d.aprovacao] ?? "neutro"}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/* ── Envio ───────────────────────────────────────────────────────────────── */

function Enviar({ onEnviou }: { onEnviou: () => void }) {
  const [categoria, setCategoria] = useState<CategoriaDocumento>("identidade");
  const [titulo, setTitulo] = useState("");
  const [validade, setValidade] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erroArquivo, setErroArquivo] = useState("");

  function escolher(f: File | null) {
    setArquivo(f);
    setErroArquivo("");
    if (!f) return;
    // Valida ANTES de subir: recusar 15 MB depois da viagem é desperdício de
    // tempo de quem está numa conexão ruim.
    if (!MIMES_ACEITOS.includes(f.type)) {
      setErroArquivo("Formato não aceito. Use PDF, imagem ou documento do Word.");
      setArquivo(null);
    } else if (f.size > TAMANHO_MAXIMO_BYTES) {
      setErroArquivo("Arquivo acima de 15 MB.");
      setArquivo(null);
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;

    setEnviando(true);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("categoria", categoria);
      form.append("titulo", titulo.trim());
      if (validade) form.append("dataValidade", validade);

      await meService.enviarDocumento(form);
      useToastStore.getState().success("Documento enviado para conferência");
      setTitulo(""); setValidade(""); setArquivo(null);
      onEnviou();
    } catch { /* o interceptor já mostrou o motivo do backend */ } finally {
      setEnviando(false);
    }
  }

  return (
    <Panel title="Enviar documento">
      <form onSubmit={enviar}>
        <FormGrid>
          <FormField label="Tipo" obrigatorio>
            <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaDocumento)}>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>
          <FormField label="Título" obrigatorio>
            <input
              type="text" value={titulo} required maxLength={160}
              placeholder="Ex.: RG frente e verso"
              onChange={e => setTitulo(e.target.value)}
            />
          </FormField>
          <FormField label="Validade (se tiver)" dica="Avisamos antes de vencer">
            <input type="date" value={validade} onChange={e => setValidade(e.target.value)} />
          </FormField>
          <FormField label="Arquivo" obrigatorio erro={erroArquivo || null} largura="total">
            <input
              type="file"
              accept={MIMES_ACEITOS.join(",")}
              onChange={e => escolher(e.target.files?.[0] ?? null)}
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="submit" className="btn-primary" disabled={enviando || !arquivo || !titulo.trim()}>
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </FormActions>
      </form>

      <p className="muted" style={{ fontSize: 12 }}>
        O RH confere o que você envia. Você recebe um aviso quando for aprovado ou rejeitado.
      </p>
    </Panel>
  );
}
