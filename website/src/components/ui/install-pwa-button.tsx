"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Monitor, X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type WindowWithPwa = Window & {
  __orkiestriDeferredPwaPrompt?: BeforeInstallPromptEvent;
};

export function InstallPwaButton({
  variant = "footer",
  onAfterClick,
}: {
  variant?: "footer" | "mobile";
  onAfterClick?: () => void;
}) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const w = window as WindowWithPwa;
    if (w.__orkiestriDeferredPwaPrompt) {
      setDeferredPrompt(w.__orkiestriDeferredPwaPrompt);
    }

    const syncPrompt = () => {
      if (w.__orkiestriDeferredPwaPrompt) {
        setDeferredPrompt(w.__orkiestriDeferredPwaPrompt);
      }
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      w.__orkiestriDeferredPwaPrompt = evt;
      setDeferredPrompt(evt);
    };

    window.addEventListener("orkiestri:pwa-ready", syncPrompt);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("orkiestri:pwa-ready", syncPrompt);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    const w = window as WindowWithPwa;
    const promptEvt = deferredPrompt || w.__orkiestriDeferredPwaPrompt;
    if (promptEvt) {
      try {
        await promptEvt.prompt();
        await promptEvt.userChoice;
        w.__orkiestriDeferredPwaPrompt = undefined;
        setDeferredPrompt(null);
        onAfterClick?.();
        return;
      } catch {
        // Fallback to manual guide modal
      }
    }
    setShowGuide(true);
  };

  return (
    <>
      {variant === "mobile" ? (
        <button
          type="button"
          onClick={handleInstall}
          className="inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-(--radius-button) border border-flame/35 bg-flame/[0.08] text-sm font-medium text-flame-soft transition-colors hover:bg-flame/[0.15]"
        >
          <Download className="h-4 w-4" aria-hidden />
          Baixar aplicativo (Celular / PC)
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstall}
          className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-flame/35 bg-flame/[0.08] px-4 py-2 text-xs font-semibold text-flame-soft transition-all hover:border-flame/60 hover:bg-flame/[0.16] hover:text-white"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Baixar aplicativo (PWA)
        </button>
      )}

      {showGuide && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/[0.12] bg-[#0e1015] p-6 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="Fechar"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-chalk-dim hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-flame/30 bg-flame/10 px-3 py-1 text-xs font-semibold text-flame-soft">
              <Download className="h-3.5 w-3.5" />
              Aplicativo Orkiestri One
            </div>

            <h3 className="text-lg font-bold text-white">
              Instale o Orkiestri no seu aparelho
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-chalk-dim">
              O Orkiestri funciona como aplicativo nativo (PWA) direto do seu
              navegador, sem ocupar espaço e com acesso rápido na tela inicial:
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Smartphone className="h-4 w-4 text-flame-soft" />
                  No iPhone / iPad (Safari)
                </div>
                <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
                  Toque no ícone{" "}
                  <span className="inline-flex items-center gap-1 font-medium text-white">
                    <Share className="h-3 w-3" /> Compartilhar
                  </span>{" "}
                  na barra inferior e escolha{" "}
                  <strong className="text-white">
                    &ldquo;Adicionar à Tela de Início&rdquo;
                  </strong>
                  .
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Smartphone className="h-4 w-4 text-flame-soft" />
                  No Android (Chrome)
                </div>
                <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
                  Toque no menu{" "}
                  <strong className="text-white">&ldquo;⋮&rdquo;</strong> no
                  canto superior direito e selecione{" "}
                  <strong className="text-white">
                    &ldquo;Instalar aplicativo&rdquo;
                  </strong>{" "}
                  (ou &ldquo;Adicionar à tela inicial&rdquo;).
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Monitor className="h-4 w-4 text-flame-soft" />
                  No Computador (Chrome ou Edge)
                </div>
                <p className="mt-1 text-xs leading-relaxed text-chalk-dim">
                  Clique no ícone de{" "}
                  <strong className="text-white">
                    Instalar Orkiestri One
                  </strong>{" "}
                  no lado direito da barra de endereço (ou no menu ⋮ → Salvar e
                  compartilhar → Instalar página como app).
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-xl bg-flame px-4 py-2 text-xs font-semibold text-white hover:bg-flame-soft"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

