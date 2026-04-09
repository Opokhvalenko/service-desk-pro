import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { I18nStore } from '../../core/i18n/i18n.store';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Live SLA countdown chip. Re-renders every second; switches to a "breached"
 * state once the deadline passes. Pure presentational — accepts an ISO
 * deadline and an optional already-breached flag.
 */
@Component({
  selector: 'app-sla-countdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="sla-chip" [class]="state()">
      <span class="dot"></span>
      {{ label() }}
    </span>
  `,
  styles: `
    .sla-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid transparent;
      font-variant-numeric: tabular-nums;
    }
    .dot {
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 50%;
      background: currentcolor;
    }
    .ok       { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
    .warning  { background: #fef3c7; color: #92400e; border-color: #fde68a; }
    .critical { background: #ffedd5; color: #9a3412; border-color: #fed7aa; }
    .breached { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
    .none     { background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface-variant); border-color: var(--mat-sys-outline-variant); }
  `,
})
export class SlaCountdownComponent {
  private readonly i18n = inject(I18nStore);

  readonly deadline = input<string | null>(null);
  readonly breached = input<boolean>(false);

  private readonly tick = signal(Date.now());

  constructor() {
    interval(SECOND)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.tick.set(Date.now()));
  }

  protected readonly state = computed<'ok' | 'warning' | 'critical' | 'breached' | 'none'>(() => {
    const deadline = this.deadline();
    if (!deadline) return 'none';
    if (this.breached()) return 'breached';
    const remaining = new Date(deadline).getTime() - this.tick();
    if (remaining <= 0) return 'breached';
    if (remaining < HOUR) return 'critical';
    if (remaining < 4 * HOUR) return 'warning';
    return 'ok';
  });

  protected readonly label = computed(() => {
    const uk = this.i18n.locale() === 'uk';
    const deadline = this.deadline();
    if (!deadline) return uk ? 'Без SLA' : 'No SLA';
    if (this.breached()) return uk ? 'Порушено SLA' : 'Breached';

    const remaining = new Date(deadline).getTime() - this.tick();
    if (remaining <= 0) return uk ? 'Порушено SLA' : 'Breached';

    const days = Math.floor(remaining / DAY);
    const hours = Math.floor((remaining % DAY) / HOUR);
    const minutes = Math.floor((remaining % HOUR) / MINUTE);
    const seconds = Math.floor((remaining % MINUTE) / SECOND);

    const left = uk ? 'залишилось' : 'left';
    if (days > 0) return `${days}${uk ? 'д' : 'd'} ${hours}${uk ? 'г' : 'h'} ${left}`;
    if (hours > 0) return `${hours}${uk ? 'г' : 'h'} ${minutes}${uk ? 'хв' : 'm'} ${left}`;
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    return `${mm}:${ss} ${left}`;
  });
}
