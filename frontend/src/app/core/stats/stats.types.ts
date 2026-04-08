import type { TicketPriority, TicketStatus } from '../tickets/ticket.types';

export interface DashboardStats {
  totals: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    breached: number;
    unassigned: number;
  };
  byStatus: Array<{ status: TicketStatus; count: number }>;
  byPriority: Array<{ priority: TicketPriority; count: number }>;
  myAssigned: number | null;
  avgResolutionHours: number | null;
}
