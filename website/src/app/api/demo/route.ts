import { NextResponse } from "next/server";
import { demoSchema } from "@/schemas/demo";

/**
 * Endpoint de solicitação de demonstração.
 *
 * Deixou de ser um stub: agora encaminha a solicitação para o fluxo REAL de
 * pedido de acesso do sistema (`/auth/solicitar-acesso`), que grava a
 * solicitação, notifica os administradores (sino + e-mail) e habilita a
 * aprovação no painel. O administrador aprova e o sistema envia as credenciais.
 *
 * A URL do backend vem de `BACKEND_INTERNAL_URL` (na rede Docker,
 * `http://api:3000/api`). O tráfego é servidor-a-servidor: a landing page nunca
 * fala direto com o backend a partir do navegador.
 */

const BACKEND = (
  process.env.BACKEND_INTERNAL_URL || "http://api:3000/api"
).replace(/\/$/, "");

const TIMEOUT_MS = 8000;

async function backendFetch(path: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${BACKEND}${path}`, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

/** Resolve a organização de trial ("Default") em que a solicitação deve cair. */
async function resolveOrganizationId(): Promise<string | undefined> {
  try {
    const res = await backendFetch("/auth/organizations");
    if (!res.ok) return undefined;
    const orgs: Array<{ id: string; nome?: string; slug?: string }> =
      await res.json();
    if (!Array.isArray(orgs) || orgs.length === 0) return undefined;
    const def = orgs.find(
      (o) =>
        o.slug?.toLowerCase() === "default" ||
        o.nome?.toLowerCase() === "default"
    );
    return (def ?? orgs[0]).id;
  } catch {
    return undefined;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Requisição inválida." },
      { status: 400 }
    );
  }

  const parsed = demoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Dados inválidos.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  // Repassa o IP real do cliente ao backend. O rate-limit de /solicitar-acesso
  // é por IP; sem isso, TODAS as demos chegariam com o IP do container do site
  // e dividiriam um único balde de 5/hora. O nginx já injeta o X-Forwarded-For
  // com o IP do visitante ao rotear /api/demo para cá.
  const fwd =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "";

  const d = parsed.data;
  const organizationId = await resolveOrganizationId();

  // Mapeia os campos da landing page para o contrato de /auth/solicitar-acesso.
  const payload = {
    nome: d.name,
    email: d.email,
    empresa: d.company,
    whatsapp: d.phone || undefined,
    cargo: d.role || undefined,
    motivacao: d.message || undefined,
    produtos: d.products,
    ...(organizationId ? { organizationId } : {}),
  };

  try {
    const res = await backendFetch("/auth/solicitar-acesso", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(fwd ? { "x-forwarded-for": fwd } : {}),
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      // 400 do backend costuma ser regra de negócio legível (e-mail já
      // cadastrado, solicitação pendente): repassamos a mensagem.
      const message =
        typeof json?.message === "string"
          ? json.message
          : "Não foi possível registrar sua solicitação.";
      const status = res.status >= 400 && res.status < 500 ? res.status : 502;
      return NextResponse.json({ success: false, message }, { status });
    }

    return NextResponse.json(
      {
        success: true,
        message:
          json?.message ||
          "Solicitação de demonstração recebida. Aguarde a aprovação do administrador.",
        data: null,
      },
      { status: 200 }
    );
  } catch {
    // Backend fora do ar / inacessível — não fingimos sucesso.
    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível enviar sua solicitação agora. Tente novamente em alguns instantes.",
      },
      { status: 502 }
    );
  }
}
