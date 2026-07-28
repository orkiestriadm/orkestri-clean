"use client";

import { useEffect, useRef, useState } from "react";
import { useToastStore } from "@/lib/toast";
import {
  documentsService, DadosEnvio, CategoriaDocumento,
  MIMES_ACEITOS, TAMANHO_MAXIMO_BYTES,
} from "@/lib/people/documents.service";
import { Modal, FormGrid, FormField, FormActions } from "@/components/data-ui";
import { Upload, FileText, X, ShieldAlert } from "lucide-react";

/**
 * Envio de documento do colaborador.
 *
 * A validação de tipo e tamanho é feita aqui só para evitar a viagem inútil de
 * até 15 MB — a decisão vale é a do servidor, que revalida.
 */

const CATEGORIAS: { value: CategoriaDocumento; label: string; restrito?: boolean }[] = [
  { value: "identidade",  label: "Documento de identidade" },
  { value: "contrato",    label: "Contrato" },
  { value: "certificado", label: "Certificado" },
  { value: "formacao",    label: "Formação" },
  { value: "medico",      label: "Atestado ou laudo médico", restrito: true },
  { value: "outro",       label: "Outro" },
];

const EXTENSOES_VISIVEIS = "PDF, JPG, PNG, WEBP, DOC ou DOCX";

const formatarTamanho = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

type Props = {
  aberto: boolean;
  collaboratorId: string;
  onFechar: () => void;
  onEnviado: () => void;
};

export default function EnviarDocumento({ aberto, collaboratorId, onFechar, onEnviado }: Props) {
  const [dados, setDados] = useState<DadosEnvio>({ categoria: "identidade", titulo: "" });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    setDados({ categoria: "identidade", titulo: "" });
    setArquivo(null);
    setErros({});
  }, [aberto]);

  const categoriaSelecionada = CATEGORIAS.find(c => c.value === dados.categoria);

  function escolherArquivo(f: File | null) {
    setErros(e => ({ ...e, arquivo: "" }));
    if (!f) { setArquivo(null); return; }

    if (!MIMES_ACEITOS.includes(f.type)) {
      setErros(e => ({ ...e, arquivo: `Tipo não aceito. Envie ${EXTENSOES_VISIVEIS}.` }));
      setArquivo(null);
      return;
    }
    if (f.size > TAMANHO_MAXIMO_BYTES) {
      setErros(e => ({
        ...e,
        arquivo: `Arquivo de ${formatarTamanho(f.size)} — o limite é ${formatarTamanho(TAMANHO_MAXIMO_BYTES)}.`,
      }));
      setArquivo(null);
      return;
    }

    setArquivo(f);
    // Título vazio recebe o nome do arquivo sem extensão: quase sempre é o que
    // a pessoa digitaria mesmo.
    if (!dados.titulo.trim()) {
      setDados(d => ({ ...d, titulo: f.name.replace(/\.[^.]+$/, "") }));
    }
  }

  function validar(): boolean {
    const novos: Record<string, string> = {};
    if (!arquivo) novos.arquivo = "Escolha o arquivo";
    if (!dados.titulo.trim()) novos.titulo = "Informe um título";
    if (dados.dataValidade && dados.dataEmissao
        && new Date(dados.dataValidade) < new Date(dados.dataEmissao)) {
      novos.dataValidade = "Validade anterior à emissão";
    }
    setErros(novos);
    return Object.keys(novos).length === 0;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!validar() || !arquivo) return;

    setEnviando(true);
    try {
      await documentsService.enviar(collaboratorId, dados, arquivo);
      useToastStore.getState().success("Documento enviado", "Aguardando aprovação do RH");
      onEnviado();
      onFechar();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 400 && msg) {
        useToastStore.getState().error(
          "Não foi possível enviar",
          Array.isArray(msg) ? msg.join(". ") : msg,
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo="Enviar documento"
      subtitulo={`${EXTENSOES_VISIVEIS} · até ${formatarTamanho(TAMANHO_MAXIMO_BYTES)}`}
      onFechar={onFechar}
      largura={560}
    >
      <form onSubmit={enviar} noValidate>
        <div style={{ marginBottom: 16 }}>
          <input
            ref={inputArquivo}
            type="file"
            accept={MIMES_ACEITOS.join(",")}
            onChange={e => escolherArquivo(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />

          {arquivo ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 12,
              background: "var(--bg-hover)", border: "1px solid var(--border-subtle)",
            }}>
              <FileText size={18} style={{ color: "var(--accent-violet)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {arquivo.name}
                </div>
                <div className="num" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {formatarTamanho(arquivo.size)}
                </div>
              </div>
              <button type="button" className="btn-icon" onClick={() => escolherArquivo(null)} aria-label="Remover arquivo">
                <X size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputArquivo.current?.click()}
              style={{
                width: "100%", padding: "22px 16px", borderRadius: 12, cursor: "pointer",
                background: "var(--bg-secondary)",
                border: `1px dashed ${erros.arquivo ? "var(--accent-red)" : "var(--border-medium)"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                color: "var(--text-secondary)",
              }}
            >
              <Upload size={20} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Escolher arquivo</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{EXTENSOES_VISIVEIS}</span>
            </button>
          )}
          {erros.arquivo && (
            <span style={{ display: "block", marginTop: 6, fontSize: 11, color: "var(--accent-red)" }} role="alert">
              {erros.arquivo}
            </span>
          )}
        </div>

        <FormGrid>
          <FormField label="Categoria" obrigatorio largura="total">
            <select
              className="input-o"
              value={dados.categoria}
              onChange={e => setDados(d => ({ ...d, categoria: e.target.value as CategoriaDocumento }))}
            >
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </FormField>

          {categoriaSelecionada?.restrito && (
            <div style={{
              gridColumn: "1 / -1", display: "flex", gap: 9, alignItems: "flex-start",
              padding: "10px 12px", borderRadius: 10,
              background: "color-mix(in srgb, var(--accent-amber) 9%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-amber) 24%, transparent)",
            }}>
              <ShieldAlert size={15} style={{ color: "var(--accent-amber)", flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Documento médico é dado sensível. Só o RH e o próprio colaborador
                conseguem abrir — o gestor vê que existe, mas não o conteúdo.
              </span>
            </div>
          )}

          <FormField label="Título" obrigatorio erro={erros.titulo} largura="total">
            <input
              className="input-o"
              value={dados.titulo}
              onChange={e => setDados(d => ({ ...d, titulo: e.target.value }))}
              placeholder="Ex.: RG — frente e verso"
            />
          </FormField>

          <FormField label="Data de emissão">
            <input
              type="date" className="input-o"
              value={dados.dataEmissao ?? ""}
              onChange={e => setDados(d => ({ ...d, dataEmissao: e.target.value }))}
            />
          </FormField>

          <FormField
            label="Validade"
            erro={erros.dataValidade}
            dica="Gera alerta 30 dias antes"
          >
            <input
              type="date" className="input-o"
              value={dados.dataValidade ?? ""}
              onChange={e => setDados(d => ({ ...d, dataValidade: e.target.value }))}
            />
          </FormField>

          <FormField label="Observações" largura="total">
            <textarea
              className="input-o" rows={2}
              value={dados.descricao ?? ""}
              onChange={e => setDados(d => ({ ...d, descricao: e.target.value }))}
              placeholder="Opcional"
            />
          </FormField>
        </FormGrid>

        <FormActions>
          <button type="button" className="btn btn-ghost" onClick={onFechar} disabled={enviando}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar documento"}
          </button>
        </FormActions>
      </form>
    </Modal>
  );
}
