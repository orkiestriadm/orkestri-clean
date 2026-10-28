"use client";

import { useCallback, useEffect, useState } from "react";
import { vacationsService, SituacaoFerias } from "@/lib/people/vacations.service";

/**
 * Situação de férias do colaborador.
 *
 * O backend sincroniza os períodos a cada consulta, então recarregar depois de
 * uma solicitação já traz o saldo atualizado — não é preciso invalidar nada.
 */
export function useVacation(collaboratorId: string | null) {
  const [situacao, setSituacao] = useState<SituacaoFerias | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const carregar = useCallback(async () => {
    if (!collaboratorId) return;
    setCarregando(true);
    setErro(null);
    setSemPermissao(false);
    try {
      const r = await vacationsService.situacao(collaboratorId);
      setSituacao(r.data);
    } catch (e: any) {
      setSituacao(null);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || "Não foi possível carregar as férias.");
    } finally {
      setCarregando(false);
    }
  }, [collaboratorId]);

  useEffect(() => { carregar(); }, [carregar]);

  return { situacao, carregando, erro, semPermissao, recarregar: carregar };
}
