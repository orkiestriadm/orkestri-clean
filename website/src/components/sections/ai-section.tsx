import {
  Bot,
  ScanText,
  Sparkles,
  Workflow,
  BarChart3,
  Search,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { Section, SectionHeader } from "@/components/ui/section";
import { IconTile } from "@/components/ui/icon-tile";
import { Reveal } from "@/components/animations/reveal";

const applications = [
  { icon: Bot, label: "Agentes Inteligentes" },
  { icon: ScanText, label: "OCR" },
  { icon: Sparkles, label: "Copilotos" },
  { icon: Workflow, label: "Automação" },
  { icon: BarChart3, label: "Análise de Dados" },
  { icon: Search, label: "Busca Inteligente" },
  { icon: MessageSquare, label: "Chat Corporativo" },
  { icon: TrendingUp, label: "Predições" },
];

/** AI section — IA aplicada ao negócio (doc 05). */
export function AISection() {
  return (
    <Section>
      <SectionHeader
        eyebrow="Inteligência Artificial"
        title="Inteligência Artificial aplicada ao seu negócio."
        description="Utilizamos IA para automatizar processos, analisar informações, reduzir tarefas repetitivas e apoiar decisões estratégicas — como uma capacidade nativa, presente em toda a plataforma."
      />
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {applications.map((a, i) => (
          <Reveal key={a.label} delay={(i % 4) * 0.05}>
            <div className="flex flex-col items-center gap-3 rounded-(--radius-card) border border-gray-200 bg-white p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 motion-reduce:hover:translate-y-0">
              <IconTile icon={a.icon} size="lg" />
              <span className="text-sm font-medium text-dark">{a.label}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
