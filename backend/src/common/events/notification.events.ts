import type { NotificationType } from '@prisma/client';

export const NOTIFICATION_EVENTS = {
  NEW: 'notification.new',
} as const;

export interface NewNotificationPayload {
  id: string;
  userId: string;
  type: NotificationType;
  ticketId: string | null;
  message: string;
  createdAt: Date;
}
