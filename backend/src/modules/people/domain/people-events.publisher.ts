import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter } from "events";

/**
 * Publicador de eventos de domínio do People.
 *
 * Usa o EventEmitter da stdlib em vez de @nestjs/event-emitter: o projeto não
 * tem barramento de eventos, e não vale adicionar dependência para algo que
 * ainda não tem consumidor (CODING_STANDARDS.md §27).
 *
 * Estado atual: NÃO HÁ ASSINANTES. Publicar aqui não dispara efeito nenhum —
 * o valor é ter a costura pronta e o contrato dos eventos explícito. Quando
 * houver o primeiro consumidor real (notificações, webhooks, provisionamento
 * de acesso), este é o ponto de extensão.
 *
 * Limitação assumida: em processo e sem persistência. Um evento perdido em
 * queda do processo não é reprocessado. Para entrega garantida — webhooks
 * externos, por exemplo — a fonte de verdade é CollaboratorHistory, que é
 * gravado na mesma transação da mudança.
 */
@Injectable()
export class PeopleEventsPublisher {
  private readonly logger = new Logger(PeopleEventsPublisher.name);
  private readonly emitter = new EventEmitter();

  publish<T extends object>(evento: string, payload: T): void {
    this.logger.debug(`${evento} ${JSON.stringify(payload)}`);
    // Um assinante que estoura não pode derrubar a operação de negócio que
    // originou o evento.
    try {
      this.emitter.emit(evento, payload);
    } catch (erro) {
      this.logger.error(`Assinante de ${evento} falhou`, erro as Error);
    }
  }

  subscribe<T extends object>(evento: string, handler: (payload: T) => void): void {
    this.emitter.on(evento, handler);
  }
}
