import { Screenshot } from "@/components/ui/screenshot";
import { Celular } from "@/components/ui/celular";
import { aureliaCaptures } from "@/config/aurelia-captures";

/**
 * Uma captura real da conversa, dentro de um celular.
 *
 * Antes de 03/11/2026 a captura era um retângulo solto na página. Agora entra
 * na moldura de `ui/celular.tsx`, com a órbita em volta — o mesmo tratamento
 * que até então só o hero tinha. O print continua o mesmo arquivo e continua
 * clicável para ampliar.
 *
 * O `Screenshot` entra sem borda e sem reflexo: quem desenha a moldura é o
 * aparelho, e duas bordas concêntricas fazem a tela parecer um quadro.
 */
export function AureliaCapture({
  index,
  priority = false,
  orbita = true,
}: {
  index: number;
  priority?: boolean;
  /** Desligue onde já existe outra órbita na mesma dobra. */
  orbita?: boolean;
}) {
  const capture = aureliaCaptures[index];
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-3 flex items-center justify-center gap-2 text-xs text-chalk-dim">
        <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
        Aurélia no WhatsApp · captura real
      </div>
      <Celular orbita={orbita} largura={340}>
        <Screenshot
          src={capture.src}
          alt={capture.alt}
          width={capture.width}
          height={capture.height}
          priority={priority}
          reflection={false}
          zoomOnHover={false}
          bordered={false}
        />
      </Celular>
      <p className="mt-3 text-center text-xs leading-relaxed text-chalk-faint">
        Conversa real de teste. Clique na imagem para ampliar.
      </p>
    </div>
  );
}
