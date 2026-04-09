import { inject, Pipe, type PipeTransform } from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const WEEK = 604_800;
const MONTH = 2_592_000;
const YEAR = 31_536_000;

interface Unit {
  threshold: number;
  divisor: number;
  en: [string, string]; // [singular, plural]
  uk: [string, string, string]; // [1, 2-4, 5+]
}

const UNITS: readonly Unit[] = [
  {
    threshold: MINUTE,
    divisor: 1,
    en: ['second', 'seconds'],
    uk: ['секунду', 'секунди', 'секунд'],
  },
  {
    threshold: HOUR,
    divisor: MINUTE,
    en: ['minute', 'minutes'],
    uk: ['хвилину', 'хвилини', 'хвилин'],
  },
  { threshold: DAY, divisor: HOUR, en: ['hour', 'hours'], uk: ['годину', 'години', 'годин'] },
  { threshold: WEEK, divisor: DAY, en: ['day', 'days'], uk: ['день', 'дні', 'днів'] },
  { threshold: MONTH, divisor: WEEK, en: ['week', 'weeks'], uk: ['тиждень', 'тижні', 'тижнів'] },
  { threshold: YEAR, divisor: MONTH, en: ['month', 'months'], uk: ['місяць', 'місяці', 'місяців'] },
];

function ukPlural(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/**
 * Pipe: formats an ISO timestamp as a relative "time ago" string in the
 * current locale (en/uk). Impure so it stays reactive to the locale signal.
 */
@Pipe({ name: 'timeAgo', pure: false })
export class TimeAgoPipe implements PipeTransform {
  private readonly i18n = inject(I18nStore);

  transform(value: string | Date | null | undefined): string {
    if (!value) return '';
    const locale = this.i18n.locale();
    const date = value instanceof Date ? value : new Date(value);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (Number.isNaN(seconds)) return '';

    if (seconds < 5) return locale === 'uk' ? 'щойно' : 'just now';

    if (seconds < MINUTE) {
      return this.format(seconds, UNITS[0], locale);
    }

    for (let i = 1; i < UNITS.length; i++) {
      const unit = UNITS[i];
      if (seconds < unit.threshold) {
        const value = Math.floor(seconds / unit.divisor);
        return this.format(value, unit, locale);
      }
    }

    const years = Math.floor(seconds / YEAR);
    return locale === 'uk'
      ? `${years} ${ukPlural(years, ['рік', 'роки', 'років'])} тому`
      : `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }

  private format(value: number, unit: Unit, locale: 'en' | 'uk'): string {
    if (locale === 'uk') {
      const word = ukPlural(value, unit.uk);
      return `${value} ${word} тому`;
    }
    const word = value === 1 ? unit.en[0] : unit.en[1];
    return `${value} ${word} ago`;
  }
}
