/**
 * SLA deadline calculator (calendar hours, not business hours).
 * Pure functions — easy to unit-test.
 */

const HOUR_MS = 60 * 60 * 1000;

export function addHours(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * HOUR_MS);
}

export function shiftDeadline(deadline: Date, pausedMs: number): Date {
  return new Date(deadline.getTime() + pausedMs);
}

/** Returns true if deadline is in the past (ignoring optional grace ms). */
export function isOverdue(deadline: Date | null, now: Date = new Date()): boolean {
  if (!deadline) return false;
  return deadline.getTime() < now.getTime();
}

/** Returns ms remaining until deadline (negative if breached). */
export function timeRemainingMs(deadline: Date | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  return deadline.getTime() - now.getTime();
}
