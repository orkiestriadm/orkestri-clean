import { api } from "../api";

/**
 * Skills, squads e organograma.
 *
 * As três APIs são legadas (`/skills`, `/squads`, `/v1/people/employees`) e
 * continuam onde estão: o que muda é onde a interface vive. Reescrever
 * endpoints que funcionam só para mudar o prefixo seria risco sem retorno.
 */

/* ── Skills ───────────────────────────────────────────────────────────────── */

export const NIVEIS_SKILL = ["junior", "pleno", "senior", "especialista"] as const;
export type NivelSkill = (typeof NIVEIS_SKILL)[number];

export const ROTULO_NIVEL: Record<NivelSkill, string> = {
  junior: "Júnior", pleno: "Pleno", senior: "Sênior", especialista: "Especialista",
};

export type Skill = {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  cor: string | null;
  ativo: boolean;
  _count?: { collaborators: number };
};

export type AtribuicaoSkill = {
  id: string;
  nivel: NivelSkill;
  certificadoEm: string | null;
  validade: string | null;
  skill: Skill;
};

export const skillsService = {
  async listar(): Promise<Skill[]> {
    const { data } = await api.get("/skills");
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async criar(dados: { nome: string; categoria?: string; descricao?: string; cor?: string }) {
    const corpo: Record<string, unknown> = { nome: dados.nome.trim() };
    for (const c of ["categoria", "descricao", "cor"] as const) {
      const v = dados[c]?.trim();
      if (v) corpo[c] = v;
    }
    const { data } = await api.post("/skills", corpo);
    return data;
  },

  async atualizar(
    id: string,
    dados: { nome: string; categoria?: string; descricao?: string; cor?: string; ativo?: boolean },
  ) {
    const { data } = await api.put(`/skills/${id}`, {
      nome: dados.nome.trim(),
      categoria: dados.categoria?.trim() || null,
      descricao: dados.descricao?.trim() || null,
      cor: dados.cor || null,
      ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}),
    });
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`/skills/${id}`);
    return data;
  },

  async doColaborador(collaboratorId: string): Promise<AtribuicaoSkill[]> {
    const { data } = await api.get(`/collaborators/${collaboratorId}/skills`);
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async atribuir(collaboratorId: string, skillId: string, nivel: NivelSkill) {
    const { data } = await api.post(`/collaborators/${collaboratorId}/skills`, { skillId, nivel });
    return data;
  },

  async mudarNivel(collaboratorId: string, assignmentId: string, nivel: NivelSkill) {
    const { data } = await api.put(`/collaborators/${collaboratorId}/skills/${assignmentId}`, { nivel });
    return data;
  },

  async remover(collaboratorId: string, assignmentId: string) {
    const { data } = await api.delete(`/collaborators/${collaboratorId}/skills/${assignmentId}`);
    return data;
  },
};

/* ── Squads ───────────────────────────────────────────────────────────────── */

export type MembroSquad = {
  id: string;
  collaboratorId: string;
  alocacaoPercent: number;
  papel: string;
  collaborator?: { id: string; nomeCompleto: string | null; user?: { nome: string } | null };
};

export type Squad = {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  liderId: string | null;
  ativo: boolean;
  lider?: { id: string; nomeCompleto: string | null; user?: { nome: string } | null } | null;
  members?: MembroSquad[];
  _count?: { members: number };
};

export const squadsService = {
  async listar(): Promise<Squad[]> {
    const { data } = await api.get("/squads");
    return Array.isArray(data) ? data : (data?.data ?? []);
  },

  async obter(id: string): Promise<Squad> {
    const { data } = await api.get(`/squads/${id}`);
    return data;
  },

  async salvar(id: string | null, dados: { nome: string; descricao?: string; liderId?: string; cor?: string }) {
    const corpo: Record<string, unknown> = { nome: dados.nome.trim() };
    if (dados.descricao?.trim()) corpo.descricao = dados.descricao.trim();
    if (dados.liderId) corpo.liderId = dados.liderId;
    if (dados.cor) corpo.cor = dados.cor;
    const { data } = id
      ? await api.put(`/squads/${id}`, corpo)
      : await api.post("/squads", corpo);
    return data;
  },

  async excluir(id: string) {
    const { data } = await api.delete(`/squads/${id}`);
    return data;
  },

  async adicionarMembro(squadId: string, collaboratorId: string, alocacaoPercent: number, papel: string) {
    const { data } = await api.post(`/squads/${squadId}/members`, { collaboratorId, alocacaoPercent, papel });
    return data;
  },

  async mudarAlocacao(squadId: string, memberId: string, alocacaoPercent: number) {
    const { data } = await api.put(`/squads/${squadId}/members/${memberId}`, { alocacaoPercent });
    return data;
  },

  async removerMembro(squadId: string, memberId: string) {
    const { data } = await api.delete(`/squads/${squadId}/members/${memberId}`);
    return data;
  },
};

/* ── Organograma ──────────────────────────────────────────────────────────── */

export type NoOrganograma = {
  id: string;
  nomeExibicao: string;
  cargo: string | null;
  setor: { nome: string } | null;
  gestorId: string | null;
  filhos: NoOrganograma[];
};

type LinhaColaborador = {
  id: string;
  nomeExibicao: string;
  cargo: string | null;
  setor: { nome: string } | null;
  gestor: { id: string } | null;
};

/**
 * Monta a árvore a partir da hierarquia de gestor.
 *
 * Raízes = quem não tem gestor OU cujo gestor está fora da lista (desligado,
 * fora do escopo). Sem essa segunda condição, o subordinado de alguém invisível
 * desapareceria do organograma inteiro em vez de aparecer no topo.
 */
export function montarArvore(linhas: LinhaColaborador[]): NoOrganograma[] {
  const porId = new Map<string, NoOrganograma>();
  for (const l of linhas) {
    porId.set(l.id, {
      id: l.id, nomeExibicao: l.nomeExibicao, cargo: l.cargo,
      setor: l.setor, gestorId: l.gestor?.id ?? null, filhos: [],
    });
  }

  const raizes: NoOrganograma[] = [];
  for (const no of porId.values()) {
    const pai = no.gestorId ? porId.get(no.gestorId) : undefined;
    if (pai && pai.id !== no.id) pai.filhos.push(no);
    else raizes.push(no);
  }

  const ordenar = (ns: NoOrganograma[]) => {
    ns.sort((a, b) => a.nomeExibicao.localeCompare(b.nomeExibicao, "pt-BR"));
    ns.forEach(n => ordenar(n.filhos));
  };
  ordenar(raizes);

  return raizes;
}

export const orgService = {
  async organograma(): Promise<NoOrganograma[]> {
    const { data } = await api.get("/v1/people/employees", {
      params: { tamanho: 1000, status: "ATIVO" },
    });
    return montarArvore(data?.data ?? []);
  },
};
