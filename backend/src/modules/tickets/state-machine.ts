import { TicketStatus } from '@prisma/client';

/**
 * Allowed status transitions for tickets.
 * Source of truth — used by service + tests.
 */
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_CUSTOMER, TicketStatus.CLOSED],
  IN_PROGRESS: [
    TicketStatus.WAITING_FOR_CUSTOMER,
    TicketStatus.ESCALATED,
    TicketStatus.RESOLVED,
    TicketStatus.OPEN,
  ],
  WAITING_FOR_CUSTOMER: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, TicketStatus.CLOSED],
  ESCALATED: [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.REOPENED],
  CLOSED: [TicketStatus.REOPENED],
  REOPENED: [TicketStatus.IN_PROGRESS, TicketStatus.OPEN],
};

export function canTransition(from: TicketStatus, to: TicketStatus): boolean {
  return TICKET_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }
}

export function formatTicketNumber(num: number): string {
  return `TKT-${num.toString().padStart(6, '0')}`;
}
