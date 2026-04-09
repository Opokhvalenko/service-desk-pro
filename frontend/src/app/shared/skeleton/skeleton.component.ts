import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span class="sk" [style.width]="width()" [style.height]="height()"></span>',
  styles: `
    :host {
      display: inline-block;
      width: 100%;
    }

    .sk {
      display: block;
      width: 100%;
      border-radius: 0.5rem;
      background: linear-gradient(
        90deg,
        var(--mat-sys-surface-container) 0%,
        var(--mat-sys-surface-container-high) 50%,
        var(--mat-sys-surface-container) 100%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }

    @keyframes shimmer {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
  `,
})
export class SkeletonComponent {
  readonly width = input<string>('100%');
  readonly height = input<string>('1rem');
}
