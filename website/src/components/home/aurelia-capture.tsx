import { Screenshot } from "@/components/ui/screenshot";
import { aureliaCaptures } from "@/config/aurelia-captures";

export function AureliaCapture({ index, priority = false }: { index: number; priority?: boolean }) {
  const capture = aureliaCaptures[index];
  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="mb-4 flex items-center gap-2 text-xs text-chalk-dim">
        <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
        Aurélia no WhatsApp · captura real
      </div>
      <Screenshot src={capture.src} alt={capture.alt} width={capture.width} height={capture.height}
        priority={priority} reflection={false} zoomOnHover={false} />
      <p className="mt-4 text-xs leading-relaxed text-chalk-faint">Conversa real de teste. Clique na imagem para ampliar.</p>
    </div>
  );
}
