import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-tickets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, MatCardModule],
  template: `
    <mat-toolbar color="primary">
      <span>ServiceDesk Pro</span>
      <span style="flex: 1"></span>
      <span class="user-meta">{{ store.user()?.fullName }} · {{ store.role() }}</span>
      <button mat-icon-button (click)="logout()" aria-label="Sign out">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <main class="page">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>Tickets</mat-card-title>
          <mat-card-subtitle>Coming in Phase 5b</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <p>Auth flow is wired up. Ticket list, detail, and real-time updates land next.</p>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .page {
      max-width: 64rem;
      margin: 1.5rem auto;
      padding: 0 1rem;
    }
    .user-meta {
      font-size: 0.875rem;
      margin-right: 0.5rem;
      opacity: 0.9;
    }
  `,
})
export class TicketsPage {
  protected readonly store = inject(AuthStore);

  protected logout(): void {
    void this.store.logout();
  }
}
