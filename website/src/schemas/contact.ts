import { z } from "zod";

/** Contact / demo form schema (doc 07 / 09 — RHF + Zod). */
export const contactSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  company: z.string().max(160, "Use até 160 caracteres.").optional().or(z.literal("")),
  interest: z.enum(["product", "project", "support"]).default("product"),
  service: z.string().max(120).optional(),
  email: z.string().email("Informe um e-mail válido."),
  phone: z
    .string()
    .min(8, "Informe um telefone válido.")
    .optional()
    .or(z.literal("")),
  message: z.string().min(10, "Conte um pouco mais sobre o seu desafio."),
});

export type ContactInput = z.infer<typeof contactSchema>;
