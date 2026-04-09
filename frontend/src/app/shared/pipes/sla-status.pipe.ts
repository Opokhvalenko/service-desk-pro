import { inject, Pipe, type PipeTransform } from '@angular/core';
import { I18nStore } from '../../core/i18n/i18n.store';
import type { Ticket } from '../../core/tickets/ticket.types';

export type SlaState = 'breached' | 'critical' | 'warning' | 'ok' | 'done' | 'none';

export interface SlaInfo {
  state: SlaState;
  label: string;
  cssClass: string;
}

const HOUR_MS = 3_600_000;

/**
 * Pipe: derives a UI-friendly SLA status from a ticket. Considers both
 * `breachedAt` and the remaining time until `resolveDueAt`. Impure so it
 * stays reactive to the locale signal.
 */
@Pipe({ name: 'slaStatus', pure: false })
export class SlaStatusPipe implements PipeTransform {
  private readonly i18n = inject(I18nStore);

  transform(
    ticket: Pick<Ticket, 'status' | 'breachedAt' | 'resolveDueAt'> | null | undefined,
  ): SlaInfo {
    const uk = this.i18n.locale() === 'uk';
    if (!ticket) {
      return { state: 'none', label: uk ? '—' : '—', cssClass: 'sla-none' };
    }

    if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      return {
        state: 'done',
        label: uk ? 'Виконано' : 'Done',
        cssClass: 'sla-done',
      };
    }

    if (ticket.breachedAt) {
      return {
        state: 'breached',
        label: uk ? 'Порушено SLA' : 'Breached',
        cssClass: 'sla-breached',
      };
    }

    if (!ticket.resolveDueAt) {
      return { state: 'none', label: uk ? 'Без SLA' : 'No SLA', cssClass: 'sla-none' };
    }

    const remainingMs = new Date(ticket.resolveDueAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      return {
        state: 'breached',
        label: uk ? 'Порушено SLA' : 'Breached',
        cssClass: 'sla-breached',
      };
    }
    if (remainingMs < HOUR_MS) {
      return {
        state: 'critical',
        label: uk ? '< 1 год' : '< 1h left',
        cssClass: 'sla-critical',
      };
    }
    if (remainingMs < 4 * HOUR_MS) {
      return {
        state: 'warning',
        label: uk ? '< 4 год' : '< 4h left',
        cssClass: 'sla-warning',
      };
    }
    return {
      state: 'ok',
      label: uk ? 'У межах SLA' : 'On track',
      cssClass: 'sla-ok',
    };
  }
}
