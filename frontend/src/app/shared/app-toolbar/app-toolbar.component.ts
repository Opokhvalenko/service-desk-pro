import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { I18nStore } from '../../core/i18n/i18n.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ThemeStore } from '../../core/theme/theme.store';
import { NotificationsBellComponent } from '../notifications-bell/notifications-bell.component';

export type ToolbarSection =
  | 'dashboard'
  | 'tickets'
  | 'detail'
  | 'admin'
  | 'reports'
  | 'queue'
  | 'my-tickets'
  | 'notifications'
  | 'profile';

@Component({
  selector: 'app-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    NotificationsBellComponent,
    TranslatePipe,
  ],
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
          {{ 'nav.dashboard' | tr }}
        </button>
        <button
          mat-button
          type="button"
          class="nav-link"
          [class.active]="active() === 'tickets' || active() === 'detail'"
          (click)="go('/tickets')"
        >
          <mat-icon>confirmation_number</mat-icon>
          {{ 'nav.tickets' | tr }}
        </button>
        @if (auth.role() === 'AGENT' || auth.role() === 'TEAM_LEAD' || auth.role() === 'ADMIN') {
          <button
            mat-button
            type="button"
            class="nav-link"
            [class.active]="active() === 'queue'"
            (click)="go('/queue')"
          >
            <mat-icon>inbox</mat-icon>
            {{ 'nav.queue' | tr }}
          </button>
          <button
            mat-button
            type="button"
            class="nav-link"
            [class.active]="active() === 'my-tickets'"
            (click)="go('/my-tickets')"
          >
            <mat-icon>assignment_ind</mat-icon>
            {{ 'nav.myTickets' | tr }}
          </button>
        }
        @if (auth.role() === 'ADMIN' || auth.role() === 'TEAM_LEAD') {
          <button
            mat-button
            type="button"
            class="nav-link"
            [class.active]="active() === 'reports'"
            (click)="go('/reports')"
          >
            <mat-icon>bar_chart</mat-icon>
            {{ 'nav.reports' | tr }}
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
            {{ 'nav.admin' | tr }}
          </button>
        }
      </nav>
      <span class="spacer"></span>
      <button
        mat-button
        type="button"
        class="user-meta-btn"
        [class.active]="active() === 'profile'"
        (click)="go('/profile')"
      >
        {{ auth.user()?.fullName }} · {{ auth.role() }}
      </button>
      <button
        mat-icon-button
        type="button"
        class="icon-toggle"
        (click)="theme.toggle()"
        [matTooltip]="(theme.mode() === 'dark' ? 'toggle.theme.light' : 'toggle.theme.dark') | tr"
        [attr.aria-label]="(theme.mode() === 'dark' ? 'toggle.theme.light' : 'toggle.theme.dark') | tr"
      >
        <mat-icon>{{ theme.mode() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
      <button
        mat-button
        type="button"
        class="locale-toggle"
        (click)="i18n.toggle()"
        [matTooltip]="'toggle.locale' | tr"
        [attr.aria-label]="'toggle.locale' | tr"
      >
        {{ i18n.locale() === 'uk' ? 'UA' : 'EN' }}
      </button>
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
          <span>{{ 'nav.dashboard' | tr }}</span>
        </button>
        <button mat-menu-item type="button" (click)="go('/tickets')">
          <mat-icon>confirmation_number</mat-icon>
          <span>{{ 'nav.tickets' | tr }}</span>
        </button>
        @if (auth.role() === 'AGENT' || auth.role() === 'TEAM_LEAD' || auth.role() === 'ADMIN') {
          <button mat-menu-item type="button" (click)="go('/queue')">
            <mat-icon>inbox</mat-icon>
            <span>{{ 'nav.queue' | tr }}</span>
          </button>
          <button mat-menu-item type="button" (click)="go('/my-tickets')">
            <mat-icon>assignment_ind</mat-icon>
            <span>{{ 'nav.myTickets' | tr }}</span>
          </button>
        }
        @if (auth.role() === 'ADMIN' || auth.role() === 'TEAM_LEAD') {
          <button mat-menu-item type="button" (click)="go('/reports')">
            <mat-icon>bar_chart</mat-icon>
            <span>{{ 'nav.reports' | tr }}</span>
          </button>
        }
        <button mat-menu-item type="button" (click)="go('/profile')">
          <mat-icon>person</mat-icon>
          <span>{{ 'nav.profile' | tr }}</span>
        </button>
        @if (auth.role() === 'ADMIN') {
          <button mat-menu-item type="button" (click)="go('/admin/users')">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>{{ 'nav.admin' | tr }}</span>
          </button>
        }
        <button mat-menu-item type="button" (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>{{ 'nav.signOut' | tr }}</span>
        </button>
      </mat-menu>
    </header>
  `,
  styleUrl: './app-toolbar.component.scss',
})
export class AppToolbarComponent {
  readonly active = input<ToolbarSection>('tickets');

  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeStore);
  protected readonly i18n = inject(I18nStore);
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
