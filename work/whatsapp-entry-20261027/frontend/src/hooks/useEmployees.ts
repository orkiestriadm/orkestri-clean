"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  employeesService, ColaboradorLista, ColaboradorDetalhe, EventoHistorico,
  FiltrosColaboradores,
} from "@/lib/people/employees.service";

/**
 * Estado de carregamento das telas do People.
 *
 * `semPermissao` é separado de `erro` de propósito: FRONTEND.md §20 e
 * PEOPLE_FRONTEND.md §23 tratam "sem acesso" como estado próprio. Mostrar
 * "erro ao carregar" para um 403 faz o usuário tentar de novo para sempre.
 */
type EstadoBase = {
  carregando: boolean;
  erro: string | null;
  semPermissao: boolean;
};

function classificarErro(e: any): { erro: string | null; semPermissao: boolean } {
  const status = e?.response?.status;
  if (status === 403) return { erro: null, semPermissao: true };
  return {
    erro: e?.response?.data?.message || "Não foi possível carregar os dados.",
    semPermissao: false,
  };
}

export function useEmployees(filtros: FiltrosColaboradores) {
  const [itens, setItens] = useState<ColaboradorLista[]>([]);
  const [meta, setMeta] = useState({ total: 0, pagina: 1, tamanho: 25, paginas: 0 });
  const [estado, setEstado] = useState<EstadoBase>({ carregando: true, erro: null, semPermissao: false });

  // Descarta resposta de requisição obsoleta: com busca por digitação, uma
  // resposta lenta anterior pode chegar depois e sobrescrever a atual.
  const requisicaoAtual = useRef(0);

  const carregar = useCallback(async () => {
    const id = ++requisicaoAtual.current;
    setEstado({ carregando: true, erro: null, semPermissao: false });
    try {
      const resposta = await employeesService.listar(filtros);
      if (id !== requisicaoAtual.current) return;
      setItens(resposta.data);
      setMeta(resposta.meta);
      setEstado({ carregando: false, erro: null, semPermissao: false });
    } catch (e) {
      if (id !== requisicaoAtual.current) return;
      const { erro, semPermissao } = classificarErro(e);
      setItens([]);
      setEstado({ carregando: false, erro, semPermissao });
    }
    // Serializa os filtros: o objeto é recriado a cada render do componente.
  }, [JSON.stringify(filtros)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { carregar(); }, [carregar]);

  return { itens, meta, ...estado, recarregar: carregar };
}

export function useEmployee(id: string | null) {
  const [colaborador, setColaborador] = useState<ColaboradorDetalhe | null>(null);
  const [historico, setHistorico] = useState<EventoHistorico[]>([]);
  const [estado, setEstado] = useState<EstadoBase>({ carregando: true, erro: null, semPermissao: false });
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const carregar = useCallback(async () => {
    if (!id) return;
    setEstado({ carregando: true, erro: null, semPermissao: false });
    setNaoEncontrado(false);
    try {
      // O histórico é secundário: se falhar, o perfil ainda abre.
      const [perfil, hist] = await Promise.all([
        employeesService.obter(id),
        employeesService.historico(id).catch(() => ({ data: [] as EventoHistorico[] })),
      ]);
      setColaborador(perfil.data);
      setHistorico(hist.data);
      setEstado({ carregando: false, erro: null, semPermissao: false });
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setNaoEncontrado(true);
        setEstado({ carregando: false, erro: null, semPermissao: false });
        return;
      }
      const { erro, semPermissao } = classificarErro(e);
      setEstado({ carregando: false, erro, semPermissao });
    }
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  /**
   * Recarrega só a linha do tempo.
   *
   * Quase toda ação do perfil grava evento funcional — salário, benefício,
   * documento, férias, mudança de situação —, e cada uma acontece numa aba
   * diferente. Sem isto, o histórico continuava mostrando o estado do momento
   * em que a página abriu: o usuário registrava um aumento e a linha do tempo
   * dizia "nenhum evento registrado", o que parece perda de dado.
   *
   * Separado do `recarregar`: buscar o perfil inteiro para atualizar uma lista
   * secundária pisca a tela toda sem necessidade.
   */
  const recarregarHistorico = useCallback(async () => {
    if (!id) return;
    try {
      const hist = await employeesService.historico(id);
      setHistorico(hist.data);
      // Silencioso de propósito: é revalidação de fundo, e o histórico que já
      // está na tela continua válido. Erro aqui não merece interromper nada.
    } catch { /* mantém o que já estava */ }
  }, [id]);

  return {
    colaborador, historico, naoEncontrado, ...estado,
    recarregar: carregar, recarregarHistorico,
  };
}
