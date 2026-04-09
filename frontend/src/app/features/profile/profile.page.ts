import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AppToolbarComponent } from '../../shared/app-toolbar/app-toolbar.component';

@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    AppToolbarComponent,
  ],
  template: `
    <app-toolbar active="profile" />
    <section class="page">
      <header class="page-head">
        <h1>Profile</h1>
      </header>

      @if (auth.user(); as u) {
        <mat-card appearance="outlined" class="card">
          <h2>Account</h2>
          <dl class="info">
            <dt>Full name</dt>
            <dd>{{ u.fullName }}</dd>
            <dt>Email</dt>
            <dd>{{ u.email }}</dd>
            <dt>Role</dt>
            <dd>
              <span class="role-chip" [attr.data-role]="u.role">{{ u.role }}</span>
            </dd>
          </dl>
        </mat-card>
      }

      <mat-card appearance="outlined" class="card">
        <h2>Change password</h2>
        <p class="hint">After changing your password you will be signed out from all devices.</p>
        <form class="form" (submit)="$event.preventDefault(); submit()">
          <mat-form-field appearance="outline">
            <mat-label>Current password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="current-password"
              [(ngModel)]="currentPassword"
              name="currentPassword"
              required
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>New password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="new-password"
              [(ngModel)]="newPassword"
              name="newPassword"
              minlength="8"
              required
            />
            <mat-hint>At least 8 characters</mat-hint>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Confirm new password</mat-label>
            <input
              matInput
              type="password"
              autocomplete="new-password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              required
            />
          </mat-form-field>
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="saving() || !currentPassword || !newPassword || !confirmPassword"
          >
            <mat-icon>lock_reset</mat-icon>
            Change password
          </button>
        </form>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .page {
        max-width: 48rem;
        margin: 0 auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .page-head h1 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        color: var(--mat-sys-on-surface);
      }
      .card {
        background: var(--mat-sys-surface-container) !important;
        border-radius: 1rem !important;
        padding: 1.25rem 1.5rem;
      }
      .card h2 {
        margin: 0 0 0.75rem;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--mat-sys-on-surface);
      }
      .info {
        display: grid;
        grid-template-columns: 8rem 1fr;
        gap: 0.5rem 1rem;
        margin: 0;
      }
      .info dt {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.85rem;
      }
      .info dd {
        margin: 0;
        color: var(--mat-sys-on-surface);
        font-weight: 600;
      }
      .role-chip {
        display: inline-block;
        padding: 0.15rem 0.55rem;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: #eef2ff;
        color: #4338ca;
      }
      .role-chip[data-role='ADMIN'] {
        background: #fee2e2;
        color: #991b1b;
      }
      .hint {
        margin: 0 0 0.75rem;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.85rem;
      }
      .form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .form button {
        align-self: flex-start;
        margin-top: 0.5rem;
      }
      .error {
        margin: 0;
        color: #b91c1c;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class ProfilePage {
  protected readonly auth = inject(AuthStore);
  private readonly api = inject(AuthService);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  protected currentPassword = '';
  protected newPassword = '';
  protected confirmPassword = '';
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async submit(): Promise<void> {
    this.error.set(null);
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }
    if (this.newPassword.length < 8) {
      this.error.set('New password must be at least 8 characters');
      return;
    }
    this.saving.set(true);
    try {
      await this.api.changePassword(this.currentPassword, this.newPassword);
      this.snack.open('Password changed. Please sign in again.', 'OK', { duration: 3500 });
      await this.auth.logout();
      void this.router.navigate(['/login']);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? ((err as { error?: { error?: { message?: string } } }).error?.error?.message ??
            'Failed to change password')
          : 'Failed to change password';
      this.error.set(message);
    } finally {
      this.saving.set(false);
    }
  }
}
