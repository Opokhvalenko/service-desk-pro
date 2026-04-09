import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeStore } from './theme.store';

const STORAGE_KEY = 'sdp.theme';

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

const documentMock = {
  documentElement: {
    setAttribute: vi.fn(),
    style: { colorScheme: '' },
  },
};

beforeEach(() => {
  localStorageMock.clear();
  documentMock.documentElement.setAttribute.mockClear();
  documentMock.documentElement.style.colorScheme = '';
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
});

describe('ThemeStore', () => {
  it('defaults to light when nothing stored and prefers-color-scheme is light', () => {
    const store = new ThemeStore();
    expect(store.mode()).toBe('light');
  });

  it('reads stored theme on init', () => {
    localStorageMock.getItem.mockReturnValueOnce('dark');
    const store = new ThemeStore();
    expect(store.mode()).toBe('dark');
  });

  it('honours system dark preference when no stored value', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) });
    const store = new ThemeStore();
    expect(store.mode()).toBe('dark');
  });

  it('set() persists to localStorage and applies data-theme attr', () => {
    const store = new ThemeStore();
    store.set('dark');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'dark');
    expect(documentMock.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    expect(documentMock.documentElement.style.colorScheme).toBe('dark');
  });

  it('toggle() flips light ↔ dark', () => {
    const store = new ThemeStore();
    expect(store.mode()).toBe('light');
    store.toggle();
    expect(store.mode()).toBe('dark');
    store.toggle();
    expect(store.mode()).toBe('light');
  });

  it('survives localStorage throwing (SSR / privacy)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => {
      const store = new ThemeStore();
      store.toggle();
    }).not.toThrow();
  });
});
