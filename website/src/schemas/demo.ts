import { z } from "zod";

/**
 * Solicitação de demonstração da landing page.
 *
 * Diferente do `contactSchema` (contato genérico), aqui coletamos o suficiente
 * para o administrador efetivar um cadastro de acesso de demonstração: dados de
 * identificação + os produtos do Orkiestri One que a pessoa quer testar. O
 * endpoint encaminha isso para o fluxo real de solicitação de acesso do sistema.
 */
export const demoSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  company: z.string().min(2, "Informe a empresa."),
  email: z.string().email("Informe um e-mail válido."),
  phone: z
    .string()
    .min(8, "Informe um telefone válido.")
    .optional()
    .or(z.literal("")),
  role: z.string().optional().or(z.literal("")),
  products: z.array(z.string()).min(1, "Escolha ao menos um produto para testar."),
  message: z.string().optional().or(z.literal("")),
});

export type DemoInput = z.infer<typeof demoSchema>;
