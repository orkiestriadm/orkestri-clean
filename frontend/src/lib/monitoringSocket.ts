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

function getToken(): string | null {
  try {
    const fromStore = JSON.parse(localStorage.getItem("orkestri-auth") || "{}")?.state?.token;
    if (fromStore) return fromStore;
  } catch {}
  // fallback: cookie csrf (nao serve), token vem do auth store
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
