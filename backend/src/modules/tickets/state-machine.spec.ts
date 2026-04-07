import { TicketStatus } from '@prisma/client';
import { canTransition, formatTicketNumber } from './state-machine';

describe('Ticket state machine', () => {
  describe('canTransition', () => {
    it('allows NEW → OPEN', () => {
      expect(canTransition(TicketStatus.NEW, TicketStatus.OPEN)).toBe(true);
    });

    it('allows IN_PROGRESS → RESOLVED', () => {
      expect(canTransition(TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED)).toBe(true);
    });

    it('allows RESOLVED → REOPENED', () => {
      expect(canTransition(TicketStatus.RESOLVED, TicketStatus.REOPENED)).toBe(true);
    });

    it('allows CLOSED → REOPENED', () => {
      expect(canTransition(TicketStatus.CLOSED, TicketStatus.REOPENED)).toBe(true);
    });

    it('forbids NEW → RESOLVED (must go through IN_PROGRESS)', () => {
      expect(canTransition(TicketStatus.NEW, TicketStatus.RESOLVED)).toBe(false);
    });

    it('forbids CLOSED → IN_PROGRESS (must REOPEN first)', () => {
      expect(canTransition(TicketStatus.CLOSED, TicketStatus.IN_PROGRESS)).toBe(false);
    });

    it('forbids REOPENED → CLOSED directly', () => {
      expect(canTransition(TicketStatus.REOPENED, TicketStatus.CLOSED)).toBe(false);
    });

    it('forbids same-state transition', () => {
      expect(canTransition(TicketStatus.OPEN, TicketStatus.OPEN)).toBe(false);
    });
  });

  describe('formatTicketNumber', () => {
    it('pads to 6 digits', () => {
      expect(formatTicketNumber(1)).toBe('TKT-000001');
      expect(formatTicketNumber(42)).toBe('TKT-000042');
      expect(formatTicketNumber(123456)).toBe('TKT-123456');
    });
  });
});
