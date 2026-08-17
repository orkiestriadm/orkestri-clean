/**
 * Cliente WebSocket do modulo Monitoramento Operacional.
 *
 * Singleton: uma conexao por aba. Quem entra em qualquer pagina /dashboard/monitoramento
 * cria/reusa o socket. Quem sai do modulo continua sem desconectar (cheap stay-alive)
 * — desconecta no unmount do MonitoringSocketProvider.
 *
 * Eventos recebidos:
 *   status_change { organizationId, assetId, anterior, novo, ts, ... }
 *   probe_tick    { organizationId, assetId, ok, latenciaMs, status, ts }
 */
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "./store";

export type StatusChange = {
  organizationId: string;
  assetId: string;
  nome?: string;
  ip?: string;
  anterior: string;
  novo: string;
  severidade?: string;
  ts: string;
  eventId?: string;
};

export type ProbeTick = {
  organizationId: string;
  assetId: string;
  ok: boolean;
  latenciaMs: number | null;
  status: string;
  ts: string;
};

let socket: Socket | null = null;
let refs = 0;

/**
 * Não existe token para o JavaScript ler.
 *
 * Esta função procurava em `localStorage["orkestri-auth"]`, que nunca existiu:
 * o store de autenticação é um `create` puro do zustand, sem `persist`. Desde
 * que o login passou a gravar cookie HttpOnly, a única cópia do token está
 * fora do alcance do JS — de propósito.
 *
 * Quem autentica o handshake agora é o cookie, enviado pelo navegador por
 * `withCredentials` (mesma origem). Mantida só para a sessão em memória logo
 * após o login, onde o token existe sem recarga de página.
 */
function getToken(): string | null {
  try {
    return useAuthStore.getState().token ?? null;
  } catch {}
  return null;
}

export function connectMonitoringSocket(): Socket {
  refs++;
  if (socket) return socket;

  const token = getToken();
  const url = `${window.location.origin}/monitoramento`; // Nginx encaminha /socket.io para api
  socket = io(url, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    // O cookie HttpOnly é quem autentica o handshake. Sem isto o navegador não
    // o envia, e o gateway derruba a conexão por falta de token.
    withCredentials: true,
    auth: { token },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });
  return socket;
}

export function disconnectMonitoringSocket() {
  refs = Math.max(0, refs - 1);
  if (refs === 0 && socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getMonitoringSocket(): Socket | null { return socket; }
