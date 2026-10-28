"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Wallet,
  NotebookPen,
  KanbanSquare,
  CheckCheck,
  ArrowRight,
  Sparkles,
  Sun,
} from "lucide-react";
import { Container } from "@/components/ui/container";

const scenarios = [
  {
    key: "routine",
    label: "Meu dia",
    icon: Sun,
    context: "Contexto pessoal",
    title: "Antes de começar o dia, encontre o seu ritmo.",
    description:
      "Uma consulta rápida reúne o que está na sua rotina. Você escolhe quando consultar e se quer receber um resumo automático.",
    command: "meu dia",
    reply:
      "Esse comando consulta o resumo do seu dia na conta vinculada: compromissos e tarefas disponíveis para você.",
    next: "rotina",
    answer:
      "A Aurélia apresenta as opções do resumo diário. Você decide se quer ativar, escolhe o horário e pode pausar quando quiser.",
    hint: "Os resumos respeitam os dados e as permissões da sua conta.",
    href: "/products/one-space",
  },
  {
    key: "agenda",
    label: "Compromissos",
    icon: CalendarDays,
    context: "Contexto pessoal",
    title: "O compromisso sai da cabeça. Vai para a agenda.",
    description:
      "Escreva o que precisa lembrar, consulte seus compromissos e receba os avisos no WhatsApp.",
    command: "Evento: médico amanhã 14h",
    reply:
      "Esse é o formato para registrar uma consulta na agenda: título, dia e horário, na mesma mensagem.",
    next: "meus compromissos",
    answer:
      "Consulte a lista numerada. Se precisar desmarcar, envie excluir compromisso e o número do evento.",
    hint: "Também funciona para recorrências: Evento: reunião toda semana 9h.",
    href: "/products/one-space",
  },
  {
    key: "finance",
    label: "Gastos",
    icon: Wallet,
    context: "Contexto pessoal",
    title: "Anote agora. Entenda seus gastos depois.",
    description:
      "Uma compra à vista, uma despesa no cartão ou uma consulta do mês. Cada conversa tem um propósito.",
    command: "Gasto: mercado 150 no crédito",
    reply:
      "Use esse formato para registrar valor, descrição e forma de pagamento do seu gasto pessoal.",
    next: "quanto gastei esse mês",
    answer:
      "Peça o relatório do mês. Você também pode consultar por crédito, débito ou o total.",
    hint: "Parcelas: Gasto: TV 2400 crédito 12x. Contas da organização ficam no contexto empresa.",
    href: "/products/one-finance",
  },
  {
    key: "notes",
    label: "Anotações",
    icon: NotebookPen,
    context: "Contexto pessoal",
    title: "Uma ideia não precisa esperar você abrir uma tela.",
    description:
      "Guarde uma anotação no momento em que ela aparece, usando uma mensagem que você já sabe escrever.",
    command: "Nota: comprar pilha do controle",
    reply:
      "O comando Nota guarda a informação no Keep, para você não depender da memória.",
    next: "ajuda",
    answer:
      "A Aurélia mostra as opções disponíveis para sua conta e os exemplos de cada módulo.",
    hint: "As opções do menu respeitam as permissões da sua conta.",
    href: "/products/one-space",
  },
  {
    key: "projects",
    label: "Projetos",
    icon: KanbanSquare,
    context: "Contexto da empresa",
    title: "O essencial do projeto acompanha a conversa.",
    description:
      "Crie um projeto e consulte o que está em andamento. Responsáveis, prazos e etapas continuam organizados na plataforma.",
    command: "Projeto: reforma da loja",
    reply:
      "Esse é o formato para iniciar um projeto pelo WhatsApp no contexto da organização.",
    next: "minhas tarefas",
    answer:
      "Consulte as tarefas em aberto que estão com você. Para listar os projetos em andamento, envie projetos.",
    hint: "Para mudar do contexto pessoal para o da organização, envie empresa.",
    href: "/products/one-projects",
  },
];

export function AureliaShowcase() {
  const [active, setActive] = useState(0);
  const [showNext, setShowNext] = useState(false);
  const scenario = scenarios[active];
  const Icon = scenario.icon;
  return (
    <section
      id="aurelia"
      className="aurelia-showcase relative scroll-mt-24 overflow-hidden py-16 md:py-24"
    >
      <Container>
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="section-kicker">
              Uma assistente. Vários momentos do seu dia.
            </p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.07] tracking-[-.035em] text-chalk">
              Pode chamar de Aurélia.
              <br />
              <span className="text-chalk-dim">E pode chamar no WhatsApp.</span>
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-chalk-dim">
            Escolha uma situação para explorar. Esta é uma prévia ilustrativa;
            nenhuma mensagem é enviada.
          </p>
        </div>
        <div
          className="scenario-switch"
          role="group"
          aria-label="Escolha um exemplo da Aurélia"
        >
          {scenarios.map((item, index) => {
            const ItemIcon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={active === index}
                aria-controls="scenario-content"
                onClick={() => {
                  setActive(index);
                  setShowNext(false);
                }}
                className={
                  active === index
                    ? "scenario-button is-active"
                    : "scenario-button"
                }
              >
                <ItemIcon size={17} aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>
        <div
          id="scenario-content"
          className="mt-7 grid items-center gap-8 lg:grid-cols-[.85fr_1.15fr] lg:gap-16"
        >
          <div className="scenario-copy" key={`copy-${scenario.key}`}>
            <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-flame/20 bg-flame/10 text-flame-soft">
              <Icon size={23} aria-hidden />
            </span>
            <h3 className="max-w-[24ch] font-display text-2xl font-semibold leading-tight text-chalk md:text-3xl">
              {scenario.title}
            </h3>
            <p className="mt-5 max-w-md leading-relaxed text-chalk-dim">
              {scenario.description}
            </p>
            <p className="mt-6 border-l border-flame/40 pl-4 text-sm leading-relaxed text-chalk-dim">
              {scenario.hint}
            </p>
            <Link
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-flame-soft"
              href={scenario.href}
            >
              Conhecer os recursos <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
          <div className="conversation-window premium-surface" data-spotlight>
            <div className="conversation-heading">
              <div className="assistant-avatar" aria-hidden>
                a
              </div>
              <div>
                <p className="font-semibold text-chalk">Aurélia</p>
                <p className="mt-1 text-xs text-chalk-dim">
                  Assistente virtual do Orkiestri
                </p>
              </div>
              <span className="conversation-context">{scenario.context}</span>
            </div>
            <div
              className="conversation-body"
              aria-live="polite"
              aria-atomic="true"
            >
              <p className="conversation-caption">
                Exemplo de uso · textos explicativos
              </p>
              <div className="bubble bubble-out">
                <p>{scenario.command}</p>
                <CheckCheck size={14} aria-hidden />
              </div>
              <div className="bubble bubble-in">
                <span>Aurélia</span>
                <p>{scenario.reply}</p>
              </div>
              {showNext && (
                <>
                  <div className="bubble bubble-out chat-enter">
                    <p>{scenario.next}</p>
                    <CheckCheck size={14} aria-hidden />
                  </div>
                  <div className="bubble bubble-in chat-enter">
                    <span>Aurélia</span>
                    <p>{scenario.answer}</p>
                  </div>
                </>
              )}
            </div>
            <div className="conversation-actions">
              <button
                type="button"
                onClick={() => setShowNext(!showNext)}
                aria-expanded={showNext}
                className="conversation-command"
              >
                <Sparkles size={16} aria-hidden />
                {showNext
                  ? "Recomeçar exemplo"
                  : `Experimentar: ${scenario.next}`}
                <ArrowRight size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs leading-relaxed text-chalk-faint">
          Seu cadastro é no sistema Orkiestri. Os recursos seguem o plano e as
          permissões da conta. Os exemplos foram adaptados das conversas do
          produto, sem publicar dados pessoais.
        </p>
      </Container>
    </section>
  );
}
