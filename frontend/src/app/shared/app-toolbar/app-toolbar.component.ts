import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell.component';

export type ToolbarSection = 'dashboard' | 'tickets' | 'detail' | 'admin' | 'reports';

@Component({
  selector: 'app-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, NotificationsBellComponent],
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
        @if (auth.role() === 'ADMIN' || auth.role() === 'TEAM_LEAD') {
          <button
            mat-button
            type="button"
            class="nav-link"
            [class.active]="active() === 'reports'"
            (click)="go('/reports')"
          >
            <mat-icon>bar_chart</mat-icon>
            Reports
          </button>
        }
        @if (auth.role() === 'ADMIN') {
          <button
            mat-button
            type="button"
            class="nav-link"
            [class.active]="active() === 'admin'"
            (click)="go('/admin/users')"
          >
            <mat-icon>admin_panel_settings</mat-icon>
            Admin
          </button>
        }
      </nav>
      <span class="spacer"></span>
      <span class="user-meta">{{ auth.user()?.fullName }} · {{ auth.role() }}</span>
      <app-notifications-bell />
      <button
        mat-icon-button
        type="button"
        (click)="logout()"
        aria-label="Sign out"
        class="desktop-only-logout"
      >
        <mat-icon>logout</mat-icon>
      </button>

      <button
        mat-icon-button
        type="button"
        class="menu-toggle"
        [matMenuTriggerFor]="mobileMenu"
        aria-label="Open menu"
      >
        <mat-icon>menu</mat-icon>
      </button>
      <mat-menu #mobileMenu="matMenu" class="mobile-menu">
        <div class="menu-user">{{ auth.user()?.fullName }} · {{ auth.role() }}</div>
        <button mat-menu-item type="button" (click)="go('/dashboard')">
          <mat-icon>dashboard</mat-icon>
          <span>Dashboard</span>
        </button>
        <button mat-menu-item type="button" (click)="go('/tickets')">
          <mat-icon>confirmation_number</mat-icon>
          <span>Tickets</span>
        </button>
        @if (auth.role() === 'ADMIN' || auth.role() === 'TEAM_LEAD') {
          <button mat-menu-item type="button" (click)="go('/reports')">
            <mat-icon>bar_chart</mat-icon>
            <span>Reports</span>
          </button>
        }
        @if (auth.role() === 'ADMIN') {
          <button mat-menu-item type="button" (click)="go('/admin/users')">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>Admin</span>
          </button>
        }
        <button mat-menu-item type="button" (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Sign out</span>
        </button>
      </mat-menu>
    </header>
  `,
  styleUrl: './app-toolbar.component.scss',
})
export class AppToolbarComponent {
  readonly active = input<ToolbarSection>('tickets');

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
