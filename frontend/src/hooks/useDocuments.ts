"use client";

import { useCallback, useEffect, useState } from "react";
import { documentsService, Documento } from "@/lib/people/documents.service";

/**
 * Documentos de um colaborador.
 *
 * `semPermissao` separado de `erro` porque 403 aqui é comum e esperado: o
 * módulo distingue quem alcança o colaborador de quem pode ver os documentos
 * dele. Tratar como erro faria o usuário tentar de novo indefinidamente.
 */
export function useDocuments(collaboratorId: string | null) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    if (!collaboratorId) return;
    setCarregando(true);
    setErro(null);
    setSemPermissao(false);
    try {
      const resposta = await documentsService.listar(collaboratorId);
      setDocumentos(resposta.data);
    } catch (e: any) {
      setDocumentos([]);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar os documentos.");
    } finally {
      setCarregando(false);
    }
  }, [collaboratorId]);

  useEffect(() => { carregar(); }, [carregar]);

  return { documentos, carregando, erro, semPermissao, recarregar: carregar };
}
