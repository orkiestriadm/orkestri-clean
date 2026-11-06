"use client";
import { useEffect } from "react";

/**
 * Registra o service worker em TODA página, inclusive para quem ainda não
 * entrou.
 *
 * Antes quem registrava era `useNotifications`, que só roda dentro do painel e
 * só com sessão. Consequência: na tela de login — a primeira página de quem
 * chega, e a única que alguém sem conta vê — não havia service worker, e sem
 * service worker o navegador não oferece "Instalar aplicativo". O atalho só
 * aparecia para quem já estava logado, que é justamente quem menos precisa.
 *
 * Aqui NÃO se pede permissão de notificação: pedir na porta de entrada,
 * antes de a pessoa saber o que é o sistema, é o jeito mais rápido de levar um
 * "bloquear" permanente. Quem pede continua sendo `useNotifications`, dentro
 * do painel, onde a pessoa acabou de marcar um compromisso.
 *
 * `register` é idempotente: a chamada do painel devolve este mesmo registro.
 */
export default function RegistroPWA() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // Falha esperada em HTTP puro (homologação): service worker exige contexto
    // seguro. Engolir é o certo — não há nada a fazer e não é erro de código.
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
