import { MessageCircle } from "lucide-react";
import { WHATSAPP_CADASTRO } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Botão de cadastro — o único do site desde 26/10/2026.
 *
 * O verde não é escolha de estilo: diz que o clique sai do site e abre uma
 * conversa, que é exatamente o que acontece. Por isso ele não aparece em
 * nenhum outro elemento da página — se o verde virar cor de enfeite, o botão
 * deixa de ser reconhecível à distância.
 *
 * Substituiu o `TrialButton` ("Solicitar demonstração"), que abria um modal
 * de formulário. Dois caminhos de cadastro na mesma página dividiam o
 * clique; o do WhatsApp era o que o produto realmente atende.
 */
export function WhatsAppButton({
  children = "Criar minha conta no WhatsApp",
  tamanho = "lg",
  className,
}: {
  children?: React.ReactNode;
  tamanho?: "md" | "lg";
  className?: string;
}) {
  return (
    <a
      href={WHATSAPP_CADASTRO}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-(--radius-button) bg-signal font-semibold text-[#06281A]",
        "transition-all duration-200 ease-(--ease-out-quart)",
        "shadow-[0_0_0_1px_rgba(37,211,102,0.45),0_14px_40px_-12px_rgba(37,211,102,0.5)]",
        "hover:bg-signal-hover hover:shadow-[0_0_0_1px_rgba(37,211,102,0.6),0_18px_50px_-10px_rgba(37,211,102,0.65)]",
        "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-signal",
        "active:scale-[0.985] motion-reduce:active:scale-100",
        /* Aos 375px o rótulo inteiro não cabe com o respiro de desktop e
           quebrava em duas linhas dentro de um botão de altura fixa. Abaixo
           de `sm` o texto encolhe e as laterais apertam — assim ele continua
           numa linha só. */
        "gap-2.5 px-5 text-base sm:gap-3 sm:px-7",
        tamanho === "lg"
          ? "h-14 sm:text-[1.0625rem]"
          : "h-[52px]",
        className,
      )}
    >
      <MessageCircle
        className={cn(
          "shrink-0",
          tamanho === "lg" ? "h-5 w-5 sm:h-[22px] sm:w-[22px]" : "h-5 w-5",
        )}
        aria-hidden
      />
      {children}
    </a>
  );
}
