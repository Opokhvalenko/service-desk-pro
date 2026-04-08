import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import {
  TICKET_EVENTS,
  type TicketAssignedPayload,
  type TicketCommentAddedPayload,
  type TicketSlaBreachedPayload,
  type TicketStatusChangedPayload,
} from '../../common/events/ticket.events';
import type { JwtPayload } from '../auth';

@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as { token?: string })?.token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) throw new Error('No token');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });

      client.data.userId = payload.sub;
      client.data.role = payload.role;
      await client.join(`user:${payload.sub}`);
      await client.join(`role:${payload.role}`);

      this.logger.log(`Client connected: ${payload.email} (${client.id})`);
    } catch (err) {
      this.logger.warn(`Connection rejected: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ticket:join')
  async joinTicketRoom(client: Socket, ticketId: string): Promise<{ joined: string }> {
    await client.join(`ticket:${ticketId}`);
    return { joined: ticketId };
  }

  @SubscribeMessage('ticket:leave')
  async leaveTicketRoom(client: Socket, ticketId: string): Promise<{ left: string }> {
    await client.leave(`ticket:${ticketId}`);
    return { left: ticketId };
  }

  // ── Event listeners → broadcast ──

  @OnEvent(TICKET_EVENTS.STATUS_CHANGED)
  emitStatusChanged(payload: TicketStatusChangedPayload): void {
    this.server.to(`ticket:${payload.ticketId}`).emit(TICKET_EVENTS.STATUS_CHANGED, payload);
  }

  @OnEvent(TICKET_EVENTS.ASSIGNED)
  emitAssigned(payload: TicketAssignedPayload): void {
    this.server.to(`ticket:${payload.ticketId}`).emit(TICKET_EVENTS.ASSIGNED, payload);
    if (payload.assigneeId) {
      this.server.to(`user:${payload.assigneeId}`).emit(TICKET_EVENTS.ASSIGNED, payload);
    }
  }

  @OnEvent(TICKET_EVENTS.COMMENT_ADDED)
  emitComment(payload: TicketCommentAddedPayload): void {
    this.server.to(`ticket:${payload.ticketId}`).emit(TICKET_EVENTS.COMMENT_ADDED, payload);
  }

  @OnEvent(TICKET_EVENTS.SLA_BREACHED)
  emitSlaBreached(payload: TicketSlaBreachedPayload): void {
    this.server.to(`ticket:${payload.ticketId}`).emit(TICKET_EVENTS.SLA_BREACHED, payload);
    // Notify leads + admins (role rooms)
    this.server.to('role:TEAM_LEAD').emit(TICKET_EVENTS.SLA_BREACHED, payload);
    this.server.to('role:ADMIN').emit(TICKET_EVENTS.SLA_BREACHED, payload);
  }
}
