import { computed, Injectable, signal } from '@angular/core';
import { type Locale, TRANSLATIONS } from './translations';

const STORAGE_KEY = 'sdp.locale';

@Injectable({ providedIn: 'root' })
export class I18nStore {
  private readonly _locale = signal<Locale>(this.read());
  readonly locale = this._locale.asReadonly();
  readonly isUk = computed(() => this._locale() === 'uk');

  constructor() {
    this.applyHtmlLang(this._locale());
  }

  set(locale: Locale): void {
    this._locale.set(locale);
    this.applyHtmlLang(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
  }

  toggle(): void {
    this.set(this._locale() === 'en' ? 'uk' : 'en');
  }

  t(key: string): string {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[this._locale()] ?? entry.en ?? key;
  }

  private read(): Locale {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'uk') return stored;
    } catch {
      // ignore
    }
    if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('uk')) {
      return 'uk';
    }
    return 'en';
  }

  private applyHtmlLang(locale: Locale): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }
}
