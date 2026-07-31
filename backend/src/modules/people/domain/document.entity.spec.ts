import {
  DOCUMENT_APPROVAL, DOCUMENT_CATEGORY,
  canApprovalTransitionTo, allowedApprovalTransitions, exigeMotivo,
  isCategoriaSensivel, situacaoValidade, taxaConformidade,
  isMimeAceito, nomeSeguroDeArquivo, TAMANHO_MAXIMO_BYTES,
} from "./document.entity";

describe("sigilo por categoria", () => {
  // Atestado revela condição de saúde — dado sensível sob a LGPD. O gestor vê
  // que o documento existe, mas não abre.
  it("trata documento médico como sensível", () => {
    expect(isCategoriaSensivel(DOCUMENT_CATEGORY.MEDICO)).toBe(true);
  });

  it("não trata documentos comuns como sensíveis", () => {
    expect(isCategoriaSensivel(DOCUMENT_CATEGORY.CONTRATO)).toBe(false);
    expect(isCategoriaSensivel(DOCUMENT_CATEGORY.IDENTIDADE)).toBe(false);
    expect(isCategoriaSensivel(DOCUMENT_CATEGORY.CERTIFICADO)).toBe(false);
  });
});

describe("transições de aprovação", () => {
  it("permite decidir sobre documento pendente", () => {
    expect(canApprovalTransitionTo(DOCUMENT_APPROVAL.PENDENTE, DOCUMENT_APPROVAL.APROVADO)).toBe(true);
    expect(canApprovalTransitionTo(DOCUMENT_APPROVAL.PENDENTE, DOCUMENT_APPROVAL.REJEITADO)).toBe(true);
  });

  it("não permite reabrir documento aprovado para rejeição", () => {
    expect(canApprovalTransitionTo(DOCUMENT_APPROVAL.APROVADO, DOCUMENT_APPROVAL.REJEITADO)).toBe(false);
  });

  it("permite arquivar de qualquer estado ativo", () => {
    for (const de of [DOCUMENT_APPROVAL.PENDENTE, DOCUMENT_APPROVAL.APROVADO, DOCUMENT_APPROVAL.REJEITADO]) {
      expect(canApprovalTransitionTo(de, DOCUMENT_APPROVAL.ARQUIVADO)).toBe(true);
    }
  });

  it("trata arquivado como estado final", () => {
    expect(allowedApprovalTransitions(DOCUMENT_APPROVAL.ARQUIVADO)).toHaveLength(0);
    expect(canApprovalTransitionTo(DOCUMENT_APPROVAL.ARQUIVADO, DOCUMENT_APPROVAL.PENDENTE)).toBe(false);
  });

  it("exige motivo apenas na rejeição", () => {
    expect(exigeMotivo(DOCUMENT_APPROVAL.REJEITADO)).toBe(true);
    expect(exigeMotivo(DOCUMENT_APPROVAL.APROVADO)).toBe(false);
    expect(exigeMotivo(DOCUMENT_APPROVAL.ARQUIVADO)).toBe(false);
  });
});

describe("situação de validade", () => {
  const hoje = new Date("2026-07-28T14:30:00");

  it("classifica documento sem validade", () => {
    expect(situacaoValidade(null, hoje)).toBe("sem_validade");
    expect(situacaoValidade(undefined, hoje)).toBe("sem_validade");
  });

  it("classifica documento vencido", () => {
    expect(situacaoValidade(new Date("2026-07-27"), hoje)).toBe("vencido");
  });

  // Compara por dia, não por instante: vencer hoje não é estar vencido às 14h30.
  it("considera vigente o documento que vence hoje", () => {
    expect(situacaoValidade(new Date("2026-07-28T00:00:00"), hoje)).toBe("vence_em_breve");
  });

  it("alerta dentro da janela de 30 dias", () => {
    expect(situacaoValidade(new Date("2026-08-15"), hoje)).toBe("vence_em_breve");
    expect(situacaoValidade(new Date("2026-08-27"), hoje)).toBe("vence_em_breve");
  });

  it("considera vigente além da janela", () => {
    expect(situacaoValidade(new Date("2026-09-30"), hoje)).toBe("vigente");
  });

  it("respeita janela customizada", () => {
    expect(situacaoValidade(new Date("2026-08-05"), hoje, 5)).toBe("vigente");
    expect(situacaoValidade(new Date("2026-08-01"), hoje, 5)).toBe("vence_em_breve");
  });

  it("não quebra com data inválida", () => {
    expect(situacaoValidade("não é data", hoje)).toBe("sem_validade");
  });
});

describe("taxa de conformidade", () => {
  it("calcula a proporção de aprovados", () => {
    expect(taxaConformidade(8, 10)).toBe(80);
    expect(taxaConformidade(10, 10)).toBe(100);
  });

  // Sem exigências não há descumprimento: 0% sugeriria problema onde não há.
  it("devolve 100% quando não há documentos exigidos", () => {
    expect(taxaConformidade(0, 0)).toBe(100);
    expect(taxaConformidade(0, -1)).toBe(100);
  });

  it("devolve 0% quando nada foi aprovado", () => {
    expect(taxaConformidade(0, 5)).toBe(0);
  });
});

describe("validação de arquivo", () => {
  it("aceita os formatos esperados de documento", () => {
    expect(isMimeAceito("application/pdf")).toBe(true);
    expect(isMimeAceito("image/jpeg")).toBe(true);
    expect(isMimeAceito("image/png")).toBe(true);
  });

  // Lista de permissão, não de bloqueio. SVG fica de fora: carrega script.
  it("recusa tipos executáveis ou com script", () => {
    expect(isMimeAceito("image/svg+xml")).toBe(false);
    expect(isMimeAceito("text/html")).toBe(false);
    expect(isMimeAceito("application/x-msdownload")).toBe(false);
    expect(isMimeAceito(undefined)).toBe(false);
    expect(isMimeAceito(null)).toBe(false);
  });

  it("mantém o teto de tamanho em 15 MB", () => {
    expect(TAMANHO_MAXIMO_BYTES).toBe(15 * 1024 * 1024);
  });
});

describe("nome seguro de arquivo", () => {
  it("usa o id e preserva a extensão", () => {
    expect(nomeSeguroDeArquivo("atestado.pdf", "abc-123")).toBe("abc-123.pdf");
  });

  it("normaliza a extensão para minúsculas", () => {
    expect(nomeSeguroDeArquivo("FOTO.JPG", "id1")).toBe("id1.jpg");
  });

  // O nome do cliente nunca vira caminho: sem isso, `../` escaparia do
  // diretório da organização.
  it("neutraliza tentativa de travessia de diretório", () => {
    expect(nomeSeguroDeArquivo("../../etc/passwd", "id1")).toBe("id1.bin");
    expect(nomeSeguroDeArquivo("..\\..\\windows\\system32", "id1")).toBe("id1.bin");
    expect(nomeSeguroDeArquivo("a/b/c.pdf", "id1")).toBe("id1.pdf");
  });

  it("usa .bin quando não há extensão reconhecível", () => {
    expect(nomeSeguroDeArquivo("semextensao", "id1")).toBe("id1.bin");
    expect(nomeSeguroDeArquivo("arquivo.extensaomuitolonga", "id1")).toBe("id1.bin");
  });
});
