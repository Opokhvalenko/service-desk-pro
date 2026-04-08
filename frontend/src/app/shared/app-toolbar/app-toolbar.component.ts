import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell.component';

export type ToolbarSection = 'dashboard' | 'tickets' | 'detail';

@Component({
  selector: 'app-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, NotificationsBellComponent],
  template: `
    <header class="toolbar">
      @if (active() === 'detail') {
        <button mat-icon-button type="button" (click)="back()" aria-label="Back">
          <mat-icon>arrow_back</mat-icon>
        </button>
      }
      <span class="brand">ServiceDesk Pro</span>
      <nav class="nav">
        <button
          mat-button
          type="button"
          class="nav-link"
          [class.active]="active() === 'dashboard'"
          (click)="go('/dashboard')"
        >
          <mat-icon>dashboard</mat-icon>
          Dashboard
        </button>
        <button
          mat-button
          type="button"
          class="nav-link"
          [class.active]="active() === 'tickets' || active() === 'detail'"
          (click)="go('/tickets')"
        >
          <mat-icon>confirmation_number</mat-icon>
          Tickets
        </button>
      </nav>
      <span class="spacer"></span>
      <span class="user-meta">{{ auth.user()?.fullName }} · {{ auth.role() }}</span>
      <app-notifications-bell />
      <button mat-icon-button type="button" (click)="logout()" aria-label="Sign out">
        <mat-icon>logout</mat-icon>
      </button>
    </header>
  `,
  styleUrl: './app-toolbar.component.scss',
})
export class AppToolbarComponent {
  readonly active = input.required<ToolbarSection>();

  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected go(path: string): void {
    void this.router.navigate([path]);
  }

  protected back(): void {
    void this.router.navigate(['/tickets']);
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
