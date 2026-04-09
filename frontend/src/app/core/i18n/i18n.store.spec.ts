import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nStore } from './i18n.store';

const STORAGE_KEY = 'sdp.locale';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v;
    }),
    clear: () => {
      store = {};
    },
  };
})();

beforeEach(() => {
  localStorageMock.clear();
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('document', { documentElement: { lang: '' } });
  vi.stubGlobal('navigator', { language: 'en-US' });
});

describe('I18nStore', () => {
  it('defaults to en when nothing stored and navigator is en', () => {
    const store = new I18nStore();
    expect(store.locale()).toBe('en');
    expect(store.isUk()).toBe(false);
  });

  it('reads stored locale on init', () => {
    localStorageMock.getItem.mockReturnValueOnce('uk');
    const store = new I18nStore();
    expect(store.locale()).toBe('uk');
    expect(store.isUk()).toBe(true);
  });

  it('falls back to uk when navigator language starts with uk', () => {
    vi.stubGlobal('navigator', { language: 'uk-UA' });
    const store = new I18nStore();
    expect(store.locale()).toBe('uk');
  });

  it('set() persists to localStorage and updates html lang', () => {
    const store = new I18nStore();
    store.set('uk');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'uk');
    expect(store.locale()).toBe('uk');
    expect(
      (globalThis as { document: { documentElement: { lang: string } } }).document.documentElement
        .lang,
    ).toBe('uk');
  });

  it('toggle() flips locale', () => {
    const store = new I18nStore();
    expect(store.locale()).toBe('en');
    store.toggle();
    expect(store.locale()).toBe('uk');
    store.toggle();
    expect(store.locale()).toBe('en');
  });

  it('t() returns translation in current locale', () => {
    const store = new I18nStore();
    expect(store.t('nav.dashboard')).toBe('Dashboard');
    store.set('uk');
    expect(store.t('nav.dashboard')).toBe('Дашборд');
  });

  it('t() returns the key itself for unknown translations', () => {
    const store = new I18nStore();
    expect(store.t('unknown.key.xyz')).toBe('unknown.key.xyz');
  });

  it('survives localStorage throwing (privacy mode)', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    vi.stubGlobal('localStorage', throwingStorage);
    expect(() => {
      const store = new I18nStore();
      store.set('uk');
      expect(store.locale()).toBe('uk');
    }).not.toThrow();
  });
});
