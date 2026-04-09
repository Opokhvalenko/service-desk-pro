import { inject, Pipe, type PipeTransform } from '@angular/core';
import { I18nStore } from './i18n.store';

@Pipe({ name: 'tr', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nStore);

  transform(key: string): string {
    // Touch the signal so the pipe re-runs on locale change
    this.i18n.locale();
    return this.i18n.t(key);
  }
}
