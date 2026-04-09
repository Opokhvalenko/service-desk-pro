import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeAgoPipe } from './time-ago.pipe';

type Locale = 'en' | 'uk';

function makePipe(locale: Locale): TimeAgoPipe {
  const pipe = Object.create(TimeAgoPipe.prototype) as TimeAgoPipe & {
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

describe('TimeAgoPipe — English', () => {
  const pipe = () => makePipe('en');

  it('returns empty string for null/undefined', () => {
    expect(pipe().transform(null)).toBe('');
    expect(pipe().transform(undefined)).toBe('');
  });

  it('returns "just now" for < 5s', () => {
    expect(pipe().transform(new Date(NOW - 2_000).toISOString())).toBe('just now');
  });

  it('formats seconds with plural', () => {
    expect(pipe().transform(new Date(NOW - 10_000).toISOString())).toBe('10 seconds ago');
    expect(pipe().transform(new Date(NOW - 1_000 * 30).toISOString())).toBe('30 seconds ago');
  });

  it('formats singular minute', () => {
    expect(pipe().transform(new Date(NOW - 60_000).toISOString())).toBe('1 minute ago');
  });

  it('formats plural minutes', () => {
    expect(pipe().transform(new Date(NOW - 5 * 60_000).toISOString())).toBe('5 minutes ago');
  });

  it('formats hours', () => {
    expect(pipe().transform(new Date(NOW - 3 * 3_600_000).toISOString())).toBe('3 hours ago');
  });

  it('formats days', () => {
    expect(pipe().transform(new Date(NOW - 2 * 86_400_000).toISOString())).toBe('2 days ago');
  });

  it('formats years', () => {
    expect(pipe().transform(new Date(NOW - 2 * 31_536_000_000).toISOString())).toBe('2 years ago');
  });

  it('returns empty string for invalid date', () => {
    expect(pipe().transform('not-a-date')).toBe('');
  });
});

describe('TimeAgoPipe — Ukrainian (plural rules)', () => {
  const pipe = () => makePipe('uk');

  it('uses "щойно" for < 5s', () => {
    expect(pipe().transform(new Date(NOW - 2_000).toISOString())).toBe('щойно');
  });

  it('singular form for 1 (1 хвилину тому)', () => {
    expect(pipe().transform(new Date(NOW - 60_000).toISOString())).toBe('1 хвилину тому');
  });

  it('few form for 2-4 (3 хвилини тому)', () => {
    expect(pipe().transform(new Date(NOW - 3 * 60_000).toISOString())).toBe('3 хвилини тому');
  });

  it('many form for 5+ (5 хвилин тому)', () => {
    expect(pipe().transform(new Date(NOW - 5 * 60_000).toISOString())).toBe('5 хвилин тому');
  });

  it('many form for 11 (edge: mod10=1 but mod100=11)', () => {
    expect(pipe().transform(new Date(NOW - 11 * 60_000).toISOString())).toBe('11 хвилин тому');
  });

  it('few form for 22 (mod10=2)', () => {
    expect(pipe().transform(new Date(NOW - 22 * 60_000).toISOString())).toBe('22 хвилини тому');
  });

  it('formats hours in Ukrainian', () => {
    expect(pipe().transform(new Date(NOW - 1 * 3_600_000).toISOString())).toBe('1 годину тому');
    expect(pipe().transform(new Date(NOW - 5 * 3_600_000).toISOString())).toBe('5 годин тому');
  });
});
