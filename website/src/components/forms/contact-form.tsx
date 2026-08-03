"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { contactSchema, type ContactInput } from "@/schemas/contact";

type Status = "idle" | "submitting" | "success" | "error";

/** Contact / demo form — RHF + Zod, inline validation, submit feedback. */
export function ContactForm({ endpoint = "/api/contact" }: { endpoint?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    mode: "onBlur",
  });

  async function onSubmit(data: ContactInput) {
    setStatus("submitting");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("request failed");
      setStatus("success");
      reset();
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-(--radius-card) border border-gray-200 bg-white p-10 text-center">
        <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />
        <h3 className="text-xl font-semibold text-dark">
          Recebemos sua solicitação
        </h3>
        <p className="text-gray-600">
          Nossa equipe entrará em contato em breve.
        </p>
        <Button variant="secondary" onClick={() => setStatus("idle")}>
          Enviar outra mensagem
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-5 rounded-(--radius-card) border border-gray-200 bg-white p-6 md:p-8"
    >
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
          label="Empresa"
          error={errors.company?.message}
          required
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

      {status === "error" && (
        <p role="alert" className="text-sm text-error">
          Não foi possível enviar sua mensagem. Tente novamente em alguns
          instantes.
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={status === "submitting"}
        className="w-full sm:w-auto"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Enviando…
          </>
        ) : (
          "Enviar solicitação"
        )}
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
