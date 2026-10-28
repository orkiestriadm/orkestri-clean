"use client";

import { useCallback, useEffect, useState } from "react";
import { benefitsService, Concessao } from "@/lib/people/benefits.service";
import { developmentService, Participacao, Avaliacao } from "@/lib/people/development.service";

/**
 * Hooks das abas de benefícios e desenvolvimento.
 *
 * Cada um separa 403 de erro real: benefício e avaliação têm permissão própria
 * e ficam fora do perfil de leitura padrão, então "não pode ver" é o caso
 * comum aqui, não uma falha.
 */

type Estado<T> = {
  dados: T;
  carregando: boolean;
  erro: string | null;
  semPermissao: boolean;
  recarregar: () => Promise<void>;
};

function useRecurso<T>(
  buscar: (() => Promise<T>) | null,
  vazio: T,
  mensagemErro: string,
): Estado<T> {
  const [dados, setDados] = useState<T>(vazio);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [semPermissao, setSemPermissao] = useState(false);

  const recarregar = useCallback(async () => {
    if (!buscar) return;
    setCarregando(true);
    setErro(null);
    setSemPermissao(false);
    try {
      setDados(await buscar());
    } catch (e: any) {
      setDados(vazio);
      if (e?.response?.status === 403) setSemPermissao(true);
      else setErro(e?.response?.data?.message || mensagemErro);
    } finally {
      setCarregando(false);
    }
    // `vazio` é literal em toda chamada; incluí-lo faria o efeito rodar sempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar, mensagemErro]);

  useEffect(() => { recarregar(); }, [recarregar]);

  return { dados, carregando, erro, semPermissao, recarregar };
}

export function useBenefits(collaboratorId: string | null) {
  const buscar = useCallback(
    async () => {
      const r = await benefitsService.doColaborador(collaboratorId!);
      return r.data;
    },
    [collaboratorId],
  );

  return useRecurso<{ itens: Concessao[]; custoMensalVigente: number }>(
    collaboratorId ? buscar : null,
    { itens: [], custoMensalVigente: 0 },
    "Não foi possível carregar os benefícios.",
  );
}

export function useTrainings(collaboratorId: string | null) {
  const buscar = useCallback(
    async () => (await developmentService.treinamentosDe(collaboratorId!)).data,
    [collaboratorId],
  );

  return useRecurso<Participacao[]>(
    collaboratorId ? buscar : null,
    [],
    "Não foi possível carregar os treinamentos.",
  );
}

export function useReviews(collaboratorId: string | null) {
  const buscar = useCallback(
    async () => (await developmentService.avaliacoesDe(collaboratorId!)).data,
    [collaboratorId],
  );

  return useRecurso<Avaliacao[]>(
    collaboratorId ? buscar : null,
    [],
    "Não foi possível carregar as avaliações.",
  );
}
