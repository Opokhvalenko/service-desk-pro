import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'sdp.theme';

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly _mode = signal<ThemeMode>(this.read());
  readonly mode = this._mode.asReadonly();

  constructor() {
    this.apply(this._mode());
  }

  toggle(): void {
    this.set(this._mode() === 'light' ? 'dark' : 'light');
  }

  set(mode: ThemeMode): void {
    this._mode.set(mode);
    this.apply(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore (SSR / privacy mode)
    }
  }

  private read(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') return stored;
    } catch {
      // ignore
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }

  private apply(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
  }
}
