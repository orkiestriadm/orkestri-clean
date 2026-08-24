"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { products } from "@/config/products";
import { demoSchema, type DemoInput } from "@/schemas/demo";
import { cn } from "@/lib/utils";

type Status = "idle" | "submitting" | "success" | "error";

/** Produtos ofertáveis para teste — os "em breve" ficam de fora da escolha. */
const TESTABLE = products.filter((p) => !p.comingSoon);

/**
 * Formulário de solicitação de demonstração.
 *
 * Coleta os dados necessários para o administrador efetivar um cadastro de
 * acesso e a lista de produtos do Orkiestri One que o interessado quer testar.
 * Envia para `/api/demo`, que encaminha para o fluxo real de solicitação de
 * acesso do sistema (o admin aprova e o sistema envia as credenciais).
 */
export function DemoForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string>("");
  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<DemoInput>({
    resolver: zodResolver(demoSchema),
    mode: "onBlur",
    defaultValues: { products: [] },
  });

  // `watch` só alimenta o destaque visual (re-renderiza a cada seleção). A
  // decisão de adicionar/remover lê o valor FRESCO via getValues — senão dois
  // cliques no mesmo tick compartilham um snapshot velho e a primeira seleção
  // se perde.
  const selected = watch("products") ?? [];

  function toggleProduct(name: string) {
    const atual = getValues("products") ?? [];
    const next = atual.includes(name)
      ? atual.filter((p) => p !== name)
      : [...atual, name];
    setValue("products", next, { shouldValidate: status !== "idle" });
  }

  async function onSubmit(data: DemoInput) {
    setStatus("submitting");
    setServerError("");
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) {
        throw new Error(json?.message || "request failed");
      }
      setStatus("success");
      reset({ products: [] });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "");
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
          Nossa equipe vai avaliar seu pedido de acesso e, assim que aprovado,
          você receberá as credenciais no e-mail informado.
        </p>
        <Button variant="secondary" onClick={() => setStatus("idle")}>
          Enviar nova solicitação
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
        <Field id="role" label="Cargo" error={errors.role?.message}>
          <Input
            id="role"
            autoComplete="organization-title"
            aria-invalid={!!errors.role}
            {...register("role")}
          />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium text-dark">
          Quais produtos do Orkiestri One você quer testar?
          <span className="ml-0.5 text-primary">*</span>
        </legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {TESTABLE.map((p) => {
            const isOn = selected.includes(p.name);
            return (
              <button
                key={p.slug}
                type="button"
                onClick={() => toggleProduct(p.name)}
                aria-pressed={isOn}
                className={cn(
                  "flex items-start gap-3 rounded-(--radius-input) border p-3 text-left transition-colors",
                  isOn
                    ? "border-primary bg-primary-soft"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isOn
                      ? "border-primary bg-primary text-white"
                      : "border-gray-300 bg-white text-transparent"
                  )}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-dark">{p.name}</span>
                  <span className="text-xs text-gray-500">{p.category}</span>
                </span>
              </button>
            );
          })}
        </div>
        {errors.products && (
          <span className="text-sm text-error" role="alert">
            {errors.products.message}
          </span>
        )}
      </fieldset>

      <Field
        id="message"
        label="Mensagem"
        error={errors.message?.message}
      >
        <Textarea
          id="message"
          rows={4}
          placeholder="Conte-nos sobre o seu desafio ou objetivo (opcional)."
          aria-invalid={!!errors.message}
          {...register("message")}
        />
      </Field>

      {status === "error" && (
        <p role="alert" className="text-sm text-error">
          {serverError ||
            "Não foi possível enviar sua solicitação. Tente novamente em alguns instantes."}
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
