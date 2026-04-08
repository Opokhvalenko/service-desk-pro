import { addHours, isOverdue, shiftDeadline, timeRemainingMs } from './sla.calculator';

describe('SLA calculator', () => {
  const NOW = new Date('2026-04-08T12:00:00Z');

  describe('addHours', () => {
    it('adds hours correctly', () => {
      expect(addHours(NOW, 4).toISOString()).toBe('2026-04-08T16:00:00.000Z');
    });
    it('handles fractional via underlying ms', () => {
      expect(addHours(NOW, 0.5).toISOString()).toBe('2026-04-08T12:30:00.000Z');
    });
  });

  describe('shiftDeadline', () => {
    it('extends deadline by paused ms', () => {
      const deadline = new Date('2026-04-08T16:00:00Z');
      const shifted = shiftDeadline(deadline, 60 * 60 * 1000); // +1h
      expect(shifted.toISOString()).toBe('2026-04-08T17:00:00.000Z');
    });
  });

  describe('isOverdue', () => {
    it('returns false for null', () => {
      expect(isOverdue(null, NOW)).toBe(false);
    });
    it('returns true when deadline passed', () => {
      expect(isOverdue(new Date('2026-04-08T11:00:00Z'), NOW)).toBe(true);
    });
    it('returns false when deadline future', () => {
      expect(isOverdue(new Date('2026-04-08T13:00:00Z'), NOW)).toBe(false);
    });
  });

  describe('timeRemainingMs', () => {
    it('returns null for null deadline', () => {
      expect(timeRemainingMs(null, NOW)).toBeNull();
    });
    it('returns positive ms for future', () => {
      expect(timeRemainingMs(new Date('2026-04-08T13:00:00Z'), NOW)).toBe(60 * 60 * 1000);
    });
    it('returns negative ms for past', () => {
      expect(timeRemainingMs(new Date('2026-04-08T11:00:00Z'), NOW)).toBe(-60 * 60 * 1000);
    });
  });
});
