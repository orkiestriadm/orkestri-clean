"use client";

import { useState } from "react";
import { ArrowRight, CalendarDays, CheckCheck } from "lucide-react";
import { Container } from "@/components/ui/container";

const steps = [
  {
    title: "Comece a conversa",
    description:
      "O botão abre o WhatsApp com o comando de cadastro no Orkiestri pronto para enviar.",
    user: "CADASTRO",
    reply:
      "Olá! Você foi direcionado para fazer seu cadastro no Orkiestri. Vou pedir suas informações, uma de cada vez. Qual é o seu nome completo?",
    note: "Responda uma pergunta por vez. Ao escolher o uso, envie 1 para pessoal ou 2 para empresa. Você pode voltar ou corrigir um dado.",
  },
  {
    title: "Confira seus dados",
    description:
      "Responda às perguntas e confirme os dados na própria conversa.",
    user: "Confirmo meus dados.",
    reply:
      "Sua conta no Orkiestri está pronta. Envie menu para conhecer os recursos disponíveis ou começar para receber orientação passo a passo.",
    note: "O cadastro é no sistema Orkiestri. Cada recurso segue o plano e as permissões da sua conta.",
  },
  {
    title: "Organize seu primeiro dia",
    description:
      "A Aurélia guia você para registrar e confirmar um compromisso.",
    user: "começar",
    reply:
      "Escolha Meus compromissos e depois Marcar compromisso. Eu pergunto o nome, o dia e o horário, uma informação por vez. Você confere tudo antes de salvar.",
    note: "O menu também guia anotações, gastos, projetos e tarefas. Envie voltar para rever uma pergunta ou cancelar para não salvar.",
  },
];

/** Demonstração local: não envia mensagens nem cria cadastros. */
export function AureliaDemo() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  return (
    <section
      id="como-funciona"
      className="relative scroll-mt-24 overflow-hidden bg-ink-raise py-20 md:py-28"
    >
      <Container>
        <div className="grid items-center gap-10 md:grid-cols-2 lg:gap-16">
          <div>
            <span className="section-kicker">Comece por aqui</span>
            <h2 className="mt-4 font-display text-[2rem] font-semibold leading-tight text-chalk md:text-[2.75rem]">
              Seu cadastro, no seu ritmo.
            </h2>
            <p className="mt-5 max-w-lg leading-relaxed text-chalk-dim">
              Seu cadastro acontece na conversa. Veja uma demonstração das
              etapas para começar a usar o Orkiestri.
            </p>
            <div
              className="mt-8 flex flex-col gap-3"
              aria-label="Etapas da demonstração"
            >
              {steps.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  aria-pressed={active === index}
                  aria-controls="aurelia-preview"
                  onClick={() => setActive(index)}
                  className={`journey-step flex min-h-20 items-start gap-4 rounded-2xl border p-4 text-left ${active === index ? "border-flame/50 bg-flame/[0.07]" : "border-white/[0.08] bg-panel hover:border-white/25"}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${active === index ? "bg-flame text-ink" : "bg-white/[0.06] text-chalk-faint"}`}
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-semibold text-chalk">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-chalk-dim">
                      {item.description}
                    </span>
                  </span>
                  <ArrowRight
                    className="ml-auto mt-2 h-4 w-4 shrink-0 text-flame-soft"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="relative min-w-0">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 rounded-full bg-flame/[0.08] blur-3xl"
            />
            <div
              className="premium-surface relative overflow-hidden rounded-[28px]"
              data-spotlight
            >
              <div className="flex items-center gap-3 border-b border-white/10 p-5">
                <span className="assistant-avatar" aria-hidden>
                  a
                </span>
                <div>
                  <p className="font-semibold text-chalk">Aurélia</p>
                  <p className="text-xs text-chalk-faint">
                    Assistente do Orkiestri · demonstração
                  </p>
                </div>
              </div>
              <div
                id="aurelia-preview"
                aria-live="polite"
                aria-atomic="true"
                className="chat-grid min-h-[350px] space-y-6 p-5 sm:p-7"
              >
                <div
                  key={`user-${active}`}
                  className="chat-enter ml-6 rounded-2xl rounded-tr-sm border border-white/10 bg-white/[0.07] p-4"
                >
                  <p className="mb-2 text-xs text-chalk-faint">Você</p>
                  <p className="text-sm leading-relaxed text-chalk">
                    {step.user}
                  </p>
                  <CheckCheck
                    className="ml-auto mt-2 h-4 w-4 text-flame-soft"
                    aria-hidden
                  />
                </div>
                <div
                  key={`reply-${active}`}
                  className="chat-enter mr-4 rounded-2xl rounded-tl-sm border border-flame/20 bg-ink-raise p-4"
                >
                  <p className="mb-2 text-xs font-medium text-flame-soft">
                    Aurélia
                  </p>
                  <p className="text-sm leading-relaxed text-chalk">
                    {step.reply}
                  </p>
                </div>
                <p className="text-xs leading-relaxed text-chalk-dim">
                  {step.note}
                </p>
              </div>
              <div className="flex items-center gap-2 border-t border-white/10 px-5 py-4 text-xs text-chalk-faint">
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />{" "}
                Exemplo ilustrativo. Inicie seu cadastro no WhatsApp.
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
