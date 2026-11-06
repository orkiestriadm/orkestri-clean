"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCommand({ command }: { command: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }
  return (
    <div>
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-ink/70 py-1 pl-4 pr-1">
        <code className="min-w-0 flex-1 break-words text-[13px] leading-relaxed text-ember">
          {command}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copiar comando: ${command}`}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs text-chalk-dim transition-colors hover:bg-white/5 hover:text-chalk"
        >
          {status === "copied" ? (
            <Check size={16} aria-hidden />
          ) : (
            <Copy size={16} aria-hidden />
          )}
          <span className="hidden sm:inline">
            {status === "copied" ? "Copiado" : "Copiar"}
          </span>
        </button>
      </div>
      <span role="status" className="mt-1 block text-xs text-chalk-dim">
        {status === "manual"
          ? "Selecione o comando acima e copie para o WhatsApp."
          : status === "copied"
            ? "Comando copiado. Cole na conversa com a Aurélia."
            : ""}
      </span>
    </div>
  );
}
