import type { TicketStatus } from '@prisma/client';

export const TICKET_EVENTS = {
  CREATED: 'ticket.created',
  UPDATED: 'ticket.updated',
  STATUS_CHANGED: 'ticket.status_changed',
  ASSIGNED: 'ticket.assigned',
  COMMENT_ADDED: 'ticket.comment_added',
  SLA_BREACHED: 'ticket.sla_breached',
} as const;

export interface TicketCreatedPayload {
  ticketId: string;
  number: number;
  createdById: string;
}

export interface TicketStatusChangedPayload {
  ticketId: string;
  from: TicketStatus;
  to: TicketStatus;
  actorId: string;
}

export interface TicketAssignedPayload {
  ticketId: string;
  assigneeId: string | null;
  actorId: string;
}

export interface TicketCommentAddedPayload {
  ticketId: string;
  commentId: string;
  authorId: string;
  isInternal: boolean;
}

export interface TicketSlaBreachedPayload {
  ticketId: string;
  number: number;
  breachType: 'response' | 'resolve';
  dueAt: Date;
}
