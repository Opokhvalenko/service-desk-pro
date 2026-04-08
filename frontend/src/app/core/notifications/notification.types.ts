export type NotificationType =
  | 'TICKET_ASSIGNED'
  | 'TICKET_STATUS_CHANGED'
  | 'TICKET_COMMENT_ADDED'
  | 'TICKET_SLA_BREACHED';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  ticketId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}
