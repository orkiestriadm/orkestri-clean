/**
 * Versão do sistema — fonte única.
 *
 * Existe para dar ao usuário uma referência exata ao relatar problema:
 * "quebrou na 1.1.0" resolve; "quebrou hoje de manhã" não, ainda mais com
 * vários deploys no mesmo dia.
 *
 * Como numerar (semver adaptado ao produto):
 *   MAIOR — muda ou quebra fluxo existente, exige ação de quem usa
 *   MENOR — módulo ou funcionalidade nova
 *   PATCH — correção, sem funcionalidade nova
 *
 * SUBIR A VERSÃO É PARTE DO DEPLOY, não um detalhe do fim. Deploy sem bump
 * deixa duas builds diferentes se dizendo a mesma versão — pior que não ter
 * versão nenhuma, porque dá falsa confiança.
 */

export const VERSAO = "1.1.0";

/**
 * Data da versão, escrita à mão junto com o bump.
 *
 * Não é gerada no build: `new Date()` no bundle muda a cada compilação, e duas
 * builds do mesmo código pareceriam versões diferentes.
 */
export const VERSAO_DATA = "2026-07-29";

/** Nome da entrega, para dar contexto ao número. */
export const VERSAO_NOME = "Orkiestri People";

/**
 * Histórico exibido na tela Sobre, do mais recente para o mais antigo.
 *
 * Só o que muda a vida de quem usa. Refatoração interna não entra: quem lê
 * esta lista quer saber o que mudou para ele.
 */
export const HISTORICO: { versao: string; data: string; titulo: string; itens: string[] }[] = [
  {
    versao: "1.1.0",
    data: "2026-07-29",
    titulo: "Orkiestri People",
    itens: [
      "Módulo de pessoas: colaboradores, cargos, organograma e equipes",
      "Documentos do colaborador com aprovação e controle de validade",
      "Férias com período aquisitivo, saldo e painel de passivo",
      "Benefícios com vigência e custo mensal",
      "Treinamentos, certificações com validade e avaliações de desempenho",
      "Ausências e solicitações ao RH com fluxo de aprovação",
      "Indicadores de pessoas e exportação do quadro em CSV",
      "Notificações de admissão, férias, documentos e prazos vencendo",
      "Recuperação de senha por WhatsApp, além do e-mail",
    ],
  },
  {
    versao: "1.0.0",
    data: "2026-07-28",
    titulo: "Plataforma",
    itens: [
      "Chamados, projetos, frota, orçamento, ativos e conhecimento",
      "Painel de plataforma para super administradores",
      "Site institucional no mesmo domínio do sistema",
    ],
  },
];
