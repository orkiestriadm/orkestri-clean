"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useToastStore } from "@/lib/toast";
import { Paperclip, Download, Trash2, Loader2, Upload } from "lucide-react";

/**
 * Anexos do projeto — proposta, ata, escopo assinado.
 *
 * O arquivo NÃO é servido por URL estática: vive fora do diretório público e
 * sai por um endpoint que confere a organização. Por isso o download é um
 * fetch com blob, e não um `<a href>` — um link direto não carregaria a sessão
 * e devolveria 401.
 */

type Anexo = {
  id: string;
  titulo: string;
  nomeOriginal: string;
  mime: string | null;
  tamanho: number | null;
  criadoEm: string;
  criadoPor?: { id: string; nome: string } | null;
};

/** 25 MB — o mesmo teto do backend. Repetido aqui só para avisar antes de subir. */
const TAMANHO_MAXIMO = 25 * 1024 * 1024;

const tamanhoLegivel = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export default function AnexosProjeto({
  projectId, podeEditar,
}: { projectId: string; podeEditar: boolean }) {
  const [itens, setItens] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(`/projects/${projectId}/anexos`, { silent: true });
      setItens(data ?? []);
    } catch { setItens([]); } finally { setCarregando(false); }
  }, [projectId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviar(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    setEnviando(true);
    let enviados = 0;

    // Um por vez, e o erro de um não derruba os outros: subir cinco anexos e
    // perder todos porque o terceiro passou do limite seria pior que lento.
    for (const arquivo of Array.from(arquivos)) {
      if (arquivo.size > TAMANHO_MAXIMO) {
        useToastStore.getState().warning(
          `${arquivo.name} é grande demais`,
          `O limite é ${Math.round(TAMANHO_MAXIMO / 1024 / 1024)} MB.`,
        );
        continue;
      }
      const form = new FormData();
      form.append("arquivo", arquivo);
      form.append("titulo", arquivo.name);
      try {
        await api.post(`/projects/${projectId}/anexos`, form);
        enviados++;
      } catch { /* interceptor mostra o motivo */ }
    }

    if (enviados) {
      useToastStore.getState().success(
        enviados === 1 ? "Arquivo anexado" : `${enviados} arquivos anexados`,
      );
      await carregar();
    }
    setEnviando(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function baixar(a: Anexo) {
    setBaixando(a.id);
    try {
      const resposta = await api.get(`/projects/${projectId}/anexos/${a.id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(resposta.data as Blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = a.nomeOriginal;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        // Sem revogar, o blob fica retido em memória enquanto a aba viver.
        URL.revokeObjectURL(url);
      }
    } catch { /* interceptor */ } finally { setBaixando(null); }
  }

  async function remover(a: Anexo) {
    if (!confirm(`Remover o anexo "${a.titulo}"?`)) return;
    try {
      await api.delete(`/projects/${projectId}/anexos/${a.id}`);
      useToastStore.getState().success("Anexo removido");
      carregar();
    } catch { /* interceptor */ }
  }

  return (
    <div className="mb-6 card-premium p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
          <Paperclip size={13} />
          Anexos
          {itens.length > 0 && (
            <span className="text-[var(--text-muted)] font-mono">{itens.length}</span>
          )}
        </span>

        {podeEditar && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={e => enviar(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-ghost text-xs py-1.5 px-3"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
            >
              {enviando ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {enviando ? "Enviando…" : "Anexar arquivo"}
            </button>
          </>
        )}
      </div>

      {carregando ? (
        <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
      ) : itens.length === 0 ? (
        <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
          Nenhum arquivo anexado.{" "}
          {podeEditar
            ? "Proposta, ata de reunião, escopo assinado — o que sustenta as decisões do projeto."
            : "Quem edita o projeto pode anexar arquivos."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {itens.map(a => (
            <li
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-[var(--text-primary)]">
                  {a.titulo}
                </span>
                <span className="block text-[11px] text-[var(--text-muted)]">
                  {tamanhoLegivel(a.tamanho)}
                  {a.criadoPor?.nome ? ` · ${a.criadoPor.nome}` : ""}
                  {` · ${new Date(a.criadoEm).toLocaleDateString("pt-BR")}`}
                </span>
              </span>

              <button
                type="button"
                className="btn-icon"
                title={`Baixar ${a.nomeOriginal}`}
                aria-label={`Baixar ${a.nomeOriginal}`}
                onClick={() => baixar(a)}
                disabled={baixando === a.id}
              >
                {baixando === a.id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Download size={14} />}
              </button>

              {podeEditar && (
                <button
                  type="button"
                  className="btn-icon"
                  title="Remover"
                  aria-label={`Remover ${a.titulo}`}
                  onClick={() => remover(a)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
