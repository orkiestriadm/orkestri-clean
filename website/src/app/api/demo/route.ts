import { NextResponse } from "next/server";
import { contactSchema } from "@/schemas/contact";

/** Demo request endpoint. Standard response shape (doc 09). */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

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

    // TODO(integration): create a demo lead in the CRM.

    return NextResponse.json(
      {
        success: true,
        message: "Solicitação de demonstração recebida.",
        data: null,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Erro ao processar a solicitação." },
      { status: 400 }
    );
  }
}
