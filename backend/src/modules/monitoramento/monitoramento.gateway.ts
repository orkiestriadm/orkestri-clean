import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect,
  SubscribeMessage, MessageBody, ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

/**
 * Gateway WebSocket do modulo Monitoramento.
 * - Namespace /monitoramento
 * - Autenticacao por JWT no handshake (query ?token= ou auth.token)
 * - Cada socket entra em uma room "org:<organizationId>"
 * - Eventos emitidos pelo backend (via pub/sub Redis no service):
 *     status_change { assetId, anterior, novo, ts, ... }
 *     probe_tick    { assetId, ok, latenciaMs, ts }
 */
@Injectable()
@WebSocketGateway({
  namespace: "/monitoramento",
  cors: { origin: "*", credentials: true },
  transports: ["websocket", "polling"],
})
export class MonitoramentoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger("MonitoramentoGateway");
  @WebSocketServer() server!: Server;

  constructor(private readonly jwt: JwtService) {}

  /**
   * O token do handshake — e o COOKIE é o caminho que funciona.
   *
   * As três primeiras fontes assumem um token que o JavaScript possa ler. Não
   * existe mais: desde que a autenticação virou cookie HttpOnly, o store do
   * frontend deixou de guardar o token em `localStorage` — e o cliente do
   * socket seguiu procurando lá, mandando `null` no handshake. Toda conexão
   * era rejeitada aqui, silenciosamente, e a tela ficava em "conexão em tempo
   * real perdida" tentando reconectar para sempre.
   *
   * O navegador manda o cookie no handshake (mesma origem), então é dele que
   * sai o token. As outras fontes ficam para chamadas de fora do navegador.
   */
  private extractToken(client: Socket): string | null {
    const auth: any = client.handshake.auth || {};
    if (auth.token) return String(auth.token);
    const q: any = client.handshake.query || {};
    if (q.token) return String(q.token);
    const header = client.handshake.headers["authorization"];
    if (typeof header === "string" && header.startsWith("Bearer ")) return header.slice(7);

    const raw = client.handshake.headers["cookie"];
    if (typeof raw === "string") {
      for (const parte of raw.split(";")) {
        const i = parte.indexOf("=");
        if (i < 0) continue;
        if (parte.slice(0, i).trim() === "orkestri_token") {
          return decodeURIComponent(parte.slice(i + 1).trim());
        }
      }
    }
    return null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) { client.disconnect(true); return; }
      const payload: any = this.jwt.verify(token, { secret: process.env.JWT_SECRET });
      if (!payload?.organizationId) { client.disconnect(true); return; }
      client.data.user = payload;
      const room = `org:${payload.organizationId}`;
      await client.join(room);
      client.emit("ready", { ok: true });
    } catch (e: any) {
      this.logger.warn("handshake reject: " + e.message);
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage("ping")
  ping(@MessageBody() _b: any, @ConnectedSocket() client: Socket) {
    client.emit("pong", { ts: Date.now() });
  }

  // chamado pelo MonitoramentoService quando recebe mensagem do Redis
  emitStatusChange(data: any) {
    if (!data?.organizationId) return;
    this.server.to(`org:${data.organizationId}`).emit("status_change", data);
  }
  emitProbeTick(data: any) {
    if (!data?.organizationId) return;
    this.server.to(`org:${data.organizationId}`).emit("probe_tick", data);
  }
}
