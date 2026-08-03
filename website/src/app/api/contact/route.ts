import { NextResponse } from "next/server";
import { contactSchema } from "@/schemas/contact";

/**
 * Contact endpoint. Standard response shape (doc 09).
 * Integration with CRM / email provider goes here.
 */
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

    // TODO(integration): forward parsed.data to CRM / email service.

    return NextResponse.json(
      {
        success: true,
        message: "Recebemos sua solicitação. Nossa equipe entrará em contato.",
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
