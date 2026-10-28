/** Recupera sessões inválidas sem ficar preso entre o middleware e o dashboard. */
let pendingRecovery: Promise<void> | null = null;

export function recoverSession(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (pendingRecovery) return pendingRecovery;

  pendingRecovery = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const csrf = document.cookie.split(";").map(c => c.trim())
      .find(c => c.startsWith("csrf_token="))?.slice("csrf_token=".length);
    try {
      await fetch("/api/auth/clear", {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "X-CSRF-Token": csrf } : {},
        signal: controller.signal,
      });
    } catch {
      // O formulário continua acessível mesmo se a API não puder limpar o cookie.
    } finally {
      clearTimeout(timeout);
      window.location.replace("/login?reauth=1");
    }
  })();
  return pendingRecovery;
}
