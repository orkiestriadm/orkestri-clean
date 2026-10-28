// Cliente do Mercado Pago — `fetch` cru, como o resto do repositório.
//
// Sem SDK de propósito: o que usamos são cinco chamadas HTTP, e o SDK traria
// uma dependência a mais para manter no deploy sem resolver nada que o fetch
// não resolva.
//
// O que cada erro quer dizer, porque isso já custou tempo aqui:
//   - `fetch failed` / erro sem `status` → é REDE ou TLS, nunca regra de
//     negócio. O FortiGate reassinando TLS derruba integração externa; a
//     primeira coisa a conferir é o `issuer=` do certificado.
//   - HTTP 4xx com corpo → é o Mercado Pago reclamando do nosso payload, e o
//     corpo diz o quê. Por isso ele é propagado inteiro no erro.

/** Erro de chamada ao MP, com o que o MP respondeu — não um "deu errado". */
export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly corpo: string | null,
    readonly rede: boolean,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

export type Preapproval = {
  id: string;
  status: string; // pending | authorized | paused | cancelled
  init_point?: string;
  next_payment_date?: string;
  payer_email?: string;
  external_reference?: string;
  auto_recurring?: { transaction_amount?: number; frequency?: number; frequency_type?: string };
};

export type Pagamento = {
  id: number | string;
  status: string; // approved | pending | in_process | rejected | refunded | cancelled
  status_detail?: string;
  transaction_amount: number;
  payment_method_id?: string;
  payment_type_id?: string;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  external_reference?: string | null;
  metadata?: Record<string, unknown>;
  preapproval_id?: string | null;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
};

/** Pagamento gerado por uma assinatura de cartão (endpoint próprio do MP). */
export type AuthorizedPayment = {
  id: number | string;
  preapproval_id: string;
  status: string; // processed | recycling | scheduled | cancelled
  payment?: { id?: number | string; status?: string; status_detail?: string };
  transaction_amount?: number;
};

const BASE = "https://api.mercadopago.com";

export class MercadoPagoClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!accessToken) throw new Error("MercadoPagoClient exige MP_ACCESS_TOKEN.");
  }

  /** As chaves de TESTE do MP começam com TEST-; serve para o log não mentir. */
  get sandbox(): boolean {
    return this.accessToken.startsWith("TEST-");
  }

  private async chamar<T>(
    metodo: "GET" | "POST" | "PUT",
    caminho: string,
    corpo?: Record<string, unknown>,
    idempotencia?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
    // O MP aceita chave de idempotência em POST: dois cliques não geram duas
    // cobranças.
    if (idempotencia) headers["X-Idempotency-Key"] = idempotencia;

    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE}${caminho}`, {
        method: metodo,
        headers,
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch (e: any) {
      throw new MercadoPagoError(
        `Não foi possível falar com o Mercado Pago (${metodo} ${caminho}): ${e?.message || e}. ` +
          `Erro sem resposta HTTP é rede ou TLS — confira o issuer do certificado antes de mexer no código.`,
        null,
        null,
        true,
      );
    }

    const texto = await res.text();
    if (!res.ok) {
      throw new MercadoPagoError(
        `Mercado Pago respondeu ${res.status} em ${metodo} ${caminho}: ${texto}`,
        res.status,
        texto,
        false,
      );
    }
    return (texto ? JSON.parse(texto) : {}) as T;
  }

  /**
   * Assinatura de cartão, sem plano associado e com pagamento PENDENTE: quem
   * escolhe e informa o cartão é a pessoa, na página do MP (`init_point`).
   * Criar com `status: authorized` exigiria `card_token_id` — ou seja, os dados
   * do cartão passando por aqui, o que não queremos.
   */
  criarPreapproval(p: {
    valorCentavos: number;
    razao: string;
    payerEmail: string;
    backUrl: string;
    externalReference: string;
    idempotencia?: string;
  }): Promise<Preapproval> {
    return this.chamar<Preapproval>(
      "POST",
      "/preapproval",
      {
        reason: p.razao,
        payer_email: p.payerEmail,
        back_url: p.backUrl,
        external_reference: p.externalReference,
        status: "pending",
        // `start_date` fica de fora de propósito.
        //
        // Sem ele, o Mercado Pago grava start_date = momento desta chamada e
        // `has_billing_day: false` — ou seja, a cobrança se repete no DIA em
        // que a pessoa assinou, que é a regra que queremos. Conferido na API
        // real em 28/10/2026: a resposta volta com start_date e
        // next_payment_date preenchidos com o instante da criação.
        //
        // Mandar uma data explícita aqui só criaria duas formas de errar: data
        // no passado é recusada, e data no futuro adia a primeira cobrança sem
        // que nada no sistema esteja esperando por isso.
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: p.valorCentavos / 100,
          currency_id: "BRL",
        },
      },
      p.idempotencia,
    );
  }

  /** Pix avulso do mês. `cpf` só vai quando temos — a conta pode exigir. */
  criarPagamentoPix(p: {
    valorCentavos: number;
    descricao: string;
    payerEmail: string;
    primeiroNome: string;
    sobrenome?: string;
    cpf?: string | null;
    externalReference: string;
    expiraEm: Date;
    idempotencia?: string;
  }): Promise<Pagamento> {
    const payer: Record<string, unknown> = {
      email: p.payerEmail,
      first_name: p.primeiroNome,
      ...(p.sobrenome ? { last_name: p.sobrenome } : {}),
      ...(p.cpf ? { identification: { type: "CPF", number: p.cpf.replace(/\D/g, "") } } : {}),
    };
    return this.chamar<Pagamento>(
      "POST",
      "/v1/payments",
      {
        transaction_amount: p.valorCentavos / 100,
        payment_method_id: "pix",
        description: p.descricao,
        external_reference: p.externalReference,
        date_of_expiration: p.expiraEm.toISOString(),
        payer,
      },
      p.idempotencia,
    );
  }

  consultarPagamento(id: string): Promise<Pagamento> {
    return this.chamar<Pagamento>("GET", `/v1/payments/${encodeURIComponent(id)}`);
  }

  consultarPreapproval(id: string): Promise<Preapproval> {
    return this.chamar<Preapproval>("GET", `/preapproval/${encodeURIComponent(id)}`);
  }

  consultarAuthorizedPayment(id: string): Promise<AuthorizedPayment> {
    return this.chamar<AuthorizedPayment>("GET", `/authorized_payments/${encodeURIComponent(id)}`);
  }

  cancelarPreapproval(id: string): Promise<Preapproval> {
    return this.chamar<Preapproval>("PUT", `/preapproval/${encodeURIComponent(id)}`, { status: "cancelled" });
  }
}

/** O copia-e-cola do Pix, se o MP devolveu. */
export function pixCopiaECola(p: Pagamento): string | null {
  return p.point_of_interaction?.transaction_data?.qr_code || null;
}

/** Status do MP → status da nossa cobrança. Só `approved` libera acesso. */
export function statusCobranca(statusMp: string): "pago" | "pendente" | "cancelado" | "estornado" {
  switch (statusMp) {
    case "approved":
      return "pago";
    case "refunded":
    case "charged_back":
      return "estornado";
    case "rejected":
    case "cancelled":
      return "cancelado";
    default:
      return "pendente";
  }
}
