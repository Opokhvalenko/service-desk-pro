import { describe, expect, it } from 'vitest';
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TRANSITIONS } from './ticket.types';

describe('Ticket types', () => {
  describe('TICKET_TRANSITIONS', () => {
    it('covers every status as a key', () => {
      for (const status of TICKET_STATUSES) {
        expect(TICKET_TRANSITIONS[status]).toBeDefined();
      }
    });

    it('allows NEW → OPEN', () => {
      expect(TICKET_TRANSITIONS.NEW).toContain('OPEN');
    });

    it('allows IN_PROGRESS → RESOLVED', () => {
      expect(TICKET_TRANSITIONS.IN_PROGRESS).toContain('RESOLVED');
    });

    it('allows CLOSED → REOPENED only', () => {
      expect(TICKET_TRANSITIONS.CLOSED).toEqual(['REOPENED']);
    });

    it('forbids NEW → RESOLVED (must transit through IN_PROGRESS)', () => {
      expect(TICKET_TRANSITIONS.NEW).not.toContain('RESOLVED');
    });

    it('forbids self-transitions', () => {
      for (const [from, targets] of Object.entries(TICKET_TRANSITIONS)) {
        expect(targets).not.toContain(from);
      }
    });
  });

  describe('TICKET_PRIORITIES', () => {
    it('exposes 4 priorities ordered low → critical', () => {
      expect(TICKET_PRIORITIES).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    });
  });
});
