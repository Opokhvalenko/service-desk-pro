import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlaStatusPipe } from './sla-status.pipe';

type Locale = 'en' | 'uk';

/**
 * Build a pipe instance without going through Angular DI. Pipes call
 * `inject()` in field initialisers, which fails outside an injection
 * context. We bypass that by allocating a prototype-only instance and
 * assigning a stub I18nStore.
 */
function makePipe(locale: Locale): SlaStatusPipe {
  const pipe = Object.create(SlaStatusPipe.prototype) as SlaStatusPipe & {
    i18n: { locale: () => Locale };
  };
  pipe.i18n = { locale: () => locale };
  return pipe;
}

const NOW = new Date('2026-04-09T12:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SlaStatusPipe', () => {
  it('returns "none" for null ticket', () => {
    expect(makePipe('en').transform(null)).toMatchObject({ state: 'none' });
  });

  it('returns "done" for RESOLVED tickets', () => {
    const result = makePipe('en').transform({
      status: 'RESOLVED',
      breachedAt: null,
      resolveDueAt: null,
    });
    expect(result.state).toBe('done');
    expect(result.label).toBe('Done');
    expect(result.cssClass).toBe('sla-done');
  });

  it('returns "done" for CLOSED tickets in Ukrainian', () => {
    const result = makePipe('uk').transform({
      status: 'CLOSED',
      breachedAt: null,
      resolveDueAt: null,
    });
    expect(result.state).toBe('done');
    expect(result.label).toBe('Виконано');
  });

  it('returns "breached" when breachedAt is set', () => {
    const result = makePipe('en').transform({
      status: 'OPEN',
      breachedAt: new Date(NOW - 60_000).toISOString(),
      resolveDueAt: new Date(NOW + 3_600_000).toISOString(),
    });
    expect(result.state).toBe('breached');
    expect(result.cssClass).toBe('sla-breached');
  });

  it('returns "none" when there is no resolveDueAt', () => {
    const result = makePipe('en').transform({
      status: 'OPEN',
      breachedAt: null,
      resolveDueAt: null,
    });
    expect(result.state).toBe('none');
    expect(result.label).toBe('No SLA');
  });

  it('returns "breached" when resolveDueAt is in the past', () => {
    const result = makePipe('en').transform({
      status: 'OPEN',
      breachedAt: null,
      resolveDueAt: new Date(NOW - 1).toISOString(),
    });
    expect(result.state).toBe('breached');
  });

  it('returns "critical" when < 1h remaining', () => {
    const result = makePipe('en').transform({
      status: 'OPEN',
      breachedAt: null,
      resolveDueAt: new Date(NOW + 30 * 60_000).toISOString(),
    });
    expect(result.state).toBe('critical');
    expect(result.label).toBe('< 1h left');
  });

  it('returns "warning" when 1h–4h remaining', () => {
    const result = makePipe('en').transform({
      status: 'OPEN',
      breachedAt: null,
      resolveDueAt: new Date(NOW + 2 * 3_600_000).toISOString(),
    });
    expect(result.state).toBe('warning');
  });

  it('returns "ok" when > 4h remaining', () => {
    const result = makePipe('en').transform({
      status: 'OPEN',
      breachedAt: null,
      resolveDueAt: new Date(NOW + 24 * 3_600_000).toISOString(),
    });
    expect(result.state).toBe('ok');
    expect(result.label).toBe('On track');
  });
});
