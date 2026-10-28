"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { contactSchema, type ContactInput } from "@/schemas/contact";
import { siteConfig } from "@/config/site";

type Status = "idle" | "prepared";

/** Prepara um e-mail para envio explícito pelo visitante. */
export function ContactForm({ initialInterest = "product", service = "" }: { initialInterest?: ContactInput["interest"]; service?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [draft, setDraft] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
    defaultValues: { interest: initialInterest, service },
  });

  function onSubmit(data: ContactInput) {
    const interests = { product: "Produto", project: "Software sob medida", support: "Ajuda com minha conta" };
    const subject = `Contato Orkiestri — ${interests[data.interest]}`;
    const body = [`Nome: ${data.name}`, `Empresa: ${data.company || "Pessoal"}`, `E-mail: ${data.email}`, `Telefone: ${data.phone || "Não informado"}`, `Interesse: ${interests[data.interest]}`, ...(service ? [`Serviço: ${service}`] : []), "", data.message].join("\n");
    setDraft(`mailto:${siteConfig.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    setStatus("prepared");
  }

  if (status === "prepared") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-(--radius-card) border border-white/[0.08] bg-panel p-10 text-center">
        <Mail className="h-12 w-12 text-flame-soft" aria-hidden />
        <h3 className="text-xl font-semibold text-chalk">
          Sua mensagem está pronta
        </h3>
        <p className="text-chalk-dim">
          Abra seu aplicativo de e-mail, confira o conteúdo e confirme o envio para {siteConfig.contact.email}. A mensagem ainda não foi enviada.
        </p>
        <Button asChild><a href={draft}>Abrir e-mail para enviar</a></Button>
        <Button variant="secondary" onClick={() => setStatus("idle")}>Voltar e editar</Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5 rounded-(--radius-card) border border-white/[0.08] bg-panel p-6 md:p-8"
    >
      <Field id="interest" label="Como podemos ajudar?" required>
        <select id="interest" className="min-h-12 rounded-xl border border-white/15 bg-panel px-4 text-chalk" {...register("interest")}>
          <option value="product">Quero conhecer ou contratar o produto</option>
          <option value="project">Preciso de software sob medida</option>
          <option value="support">Preciso de ajuda com minha conta</option>
        </select>
      </Field>
      {service && <p className="text-sm text-chalk-dim">Serviço de interesse: {service}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Nome" error={errors.name?.message} required>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
        </Field>
        <Field
          id="company"
          label="Empresa (opcional)"
          error={errors.company?.message}
        >
          <Input
            id="company"
            autoComplete="organization"
            aria-invalid={!!errors.company}
            {...register("company")}
          />
        </Field>
        <Field id="email" label="E-mail" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Field id="phone" label="Telefone" error={errors.phone?.message}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
        </Field>
      </div>

      <Field id="message" label="Mensagem" error={errors.message?.message} required>
        <Textarea
          id="message"
          rows={5}
          placeholder="Conte-nos sobre o seu desafio ou objetivo."
          aria-invalid={!!errors.message}
          {...register("message")}
        />
      </Field>

      <p className="text-xs leading-relaxed text-chalk-faint">Este formulário prepara um e-mail. Você confere e envia pelo seu aplicativo; os dados não são enviados automaticamente pelo site. <a href="/privacy" className="underline underline-offset-4">Política de privacidade.</a></p>
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto"
      >
        Preparar mensagem por e-mail
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error && (
        <span className="text-sm text-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
