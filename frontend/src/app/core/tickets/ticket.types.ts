import type { UserRole } from '../auth/auth.types';

export type TicketStatus =
  | 'NEW'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_CUSTOMER'
  | 'ESCALATED'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REOPENED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TicketUserRef {
  id: string;
  fullName: string;
  email?: string;
  role: UserRole;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author?: { id: string; fullName: string; role: UserRole };
}

export interface Ticket {
  id: string;
  number: number;
  code: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdById: string;
  assigneeId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  firstResponseDueAt: string | null;
  resolveDueAt: string | null;
  firstResponseAt: string | null;
  breachedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: TicketUserRef;
  assignee: TicketUserRef | null;
  comments?: TicketComment[];
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListTicketsQuery {
  status?: TicketStatus;
  statusIn?: string;
  breached?: boolean;
  priority?: TicketPriority;
  assigneeId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateTicketDto {
  title: string;
  description: string;
  priority?: TicketPriority;
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  priority?: TicketPriority;
}

export const TICKET_STATUSES: TicketStatus[] = [
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'ESCALATED',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
];

export const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ['OPEN', 'IN_PROGRESS', 'CLOSED'],
  OPEN: ['IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'CLOSED'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'ESCALATED', 'RESOLVED', 'OPEN'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  ESCALATED: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['IN_PROGRESS', 'OPEN'],
};
