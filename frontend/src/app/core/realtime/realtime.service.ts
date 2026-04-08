import { effect, Injectable, inject } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../auth/auth.store';
import { TicketsStore } from '../tickets/tickets.store';

const TICKET_EVENTS = {
  STATUS_CHANGED: 'ticket.status_changed',
  ASSIGNED: 'ticket.assigned',
  COMMENT_ADDED: 'ticket.comment_added',
  SLA_BREACHED: 'ticket.sla_breached',
} as const;

interface TicketEventPayload {
  ticketId: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly auth = inject(AuthStore);
  private readonly tickets = inject(TicketsStore);
  private socket: Socket | null = null;
  private joinedTicketId: string | null = null;

  constructor() {
    effect(() => {
      const token = this.auth.accessToken();
      if (token) {
        this.connect(token);
      } else {
        this.disconnect();
      }
    });
  }

  private connect(token: string): void {
    if (this.socket?.connected) return;
    this.socket = io(environment.wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      // Re-join ticket room after reconnect
      if (this.joinedTicketId) {
        this.socket?.emit('ticket:join', this.joinedTicketId);
      }
    });

    const handler = (payload: TicketEventPayload) => {
      void this.tickets.refreshTicket(payload.ticketId);
    };

    this.socket.on(TICKET_EVENTS.STATUS_CHANGED, handler);
    this.socket.on(TICKET_EVENTS.ASSIGNED, handler);
    this.socket.on(TICKET_EVENTS.COMMENT_ADDED, handler);
    this.socket.on(TICKET_EVENTS.SLA_BREACHED, handler);
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.joinedTicketId = null;
  }

  joinTicket(ticketId: string): void {
    this.joinedTicketId = ticketId;
    this.socket?.emit('ticket:join', ticketId);
  }

  leaveTicket(ticketId: string): void {
    if (this.joinedTicketId === ticketId) this.joinedTicketId = null;
    this.socket?.emit('ticket:leave', ticketId);
  }
}
