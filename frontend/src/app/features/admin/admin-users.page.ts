import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import type { AdminUser } from '../../core/users/users.service';
import { UsersService } from '../../core/users/users.service';
import { UserFormDialog, type UserFormResult } from './user-form.dialog';

@Component({
  selector: 'app-admin-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card appearance="outlined" class="page-card">
      <header class="page-head">
        <div>
          <h1>Users</h1>
          <p class="subtitle">Manage staff and requesters</p>
        </div>
        <button mat-flat-button color="primary" type="button" (click)="openCreate()">
          <mat-icon>person_add</mat-icon>
          New user
        </button>
      </header>

      @if (loading()) {
        <div class="state"><mat-spinner diameter="36" /></div>
      } @else if (error()) {
        <div class="state error">{{ error() }}</div>
      } @else if (users().length === 0) {
        <div class="state">No users yet.</div>
      } @else {
        <table mat-table [dataSource]="users()" class="users-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let u">
              <div class="name-cell">
                <div class="avatar">{{ u.fullName.charAt(0) }}</div>
                <div>
                  <div class="full">{{ u.fullName }}</div>
                  <div class="email">{{ u.email }}</div>
                </div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef>Role</th>
            <td mat-cell *matCellDef="let u">
              <span class="role-chip" [attr.data-role]="u.role">{{ u.role }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let u">
              @if (u.isActive) {
                <span class="status active">Active</span>
              } @else {
                <span class="status inactive">Inactive</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="lastLogin">
            <th mat-header-cell *matHeaderCellDef>Last login</th>
            <td mat-cell *matCellDef="let u">
              {{ u.lastLoginAt ? (u.lastLoginAt | date: 'MMM d, y, h:mm a') : '—' }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let u" class="actions-col">
              <button
                mat-icon-button
                type="button"
                aria-label="Edit user"
                (click)="openEdit(u)"
              >
                <mat-icon>edit</mat-icon>
              </button>
              @if (u.isActive) {
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Deactivate user"
                  (click)="deactivate(u)"
                >
                  <mat-icon>block</mat-icon>
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      }
    </mat-card>
  `,
  styles: [
    `
      .page-card {
        border-radius: 1rem !important;
        background: #fff !important;
        padding: 1.5rem;
      }
      .page-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1.25rem;
      }
      h1 {
        margin: 0;
        font-size: 1.4rem;
        font-weight: 800;
        color: #0f172a;
      }
      .subtitle {
        margin: 0.2rem 0 0;
        color: #64748b;
        font-size: 0.85rem;
      }
      .state {
        padding: 2rem;
        text-align: center;
        color: #64748b;
      }
      .state.error {
        color: #b91c1c;
      }
      .users-table {
        width: 100%;
        background: transparent;
      }
      .name-cell {
        display: flex;
        align-items: center;
        gap: 0.7rem;
      }
      .avatar {
        width: 2.1rem;
        height: 2.1rem;
        border-radius: 999px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        display: grid;
        place-items: center;
        font-weight: 700;
        font-size: 0.85rem;
      }
      .full {
        font-weight: 600;
        color: #1e293b;
      }
      .email {
        font-size: 0.78rem;
        color: #64748b;
      }
      .role-chip {
        padding: 0.2rem 0.6rem;
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
      .role-chip[data-role='TEAM_LEAD'] {
        background: #fef3c7;
        color: #92400e;
      }
      .role-chip[data-role='AGENT'] {
        background: #dcfce7;
        color: #166534;
      }
      .status {
        font-size: 0.78rem;
        font-weight: 700;
      }
      .status.active {
        color: #166534;
      }
      .status.inactive {
        color: #94a3b8;
      }
      .actions-col {
        width: 6rem;
        text-align: right;
      }
    `,
  ],
})
export class AdminUsersPage implements OnInit {
  private readonly api = inject(UsersService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly columns = ['name', 'role', 'status', 'lastLogin', 'actions'];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.users.set(await this.api.list());
    } catch {
      this.error.set('Failed to load users');
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreate(): void {
    const ref = this.dialog.open(UserFormDialog, {
      width: '28rem',
      data: { user: null },
    });
    ref.afterClosed().subscribe(async (result: UserFormResult | undefined) => {
      if (!result || !result.email || !result.password) return;
      try {
        await this.api.create({
          email: result.email,
          password: result.password,
          fullName: result.fullName,
          role: result.role,
          isActive: result.isActive,
        });
        this.snack.open('User created', 'Close', { duration: 2500 });
        await this.reload();
      } catch {
        this.snack.open('Failed to create user', 'Close', { duration: 3000 });
      }
    });
  }

  protected openEdit(user: AdminUser): void {
    const ref = this.dialog.open(UserFormDialog, {
      width: '28rem',
      data: { user },
    });
    ref.afterClosed().subscribe(async (result: UserFormResult | undefined) => {
      if (!result) return;
      try {
        await this.api.update(user.id, {
          fullName: result.fullName,
          role: result.role,
          isActive: result.isActive,
        });
        this.snack.open('User updated', 'Close', { duration: 2500 });
        await this.reload();
      } catch {
        this.snack.open('Failed to update user', 'Close', { duration: 3000 });
      }
    });
  }

  protected async deactivate(user: AdminUser): Promise<void> {
    if (!confirm(`Deactivate ${user.fullName}?`)) return;
    try {
      await this.api.deactivate(user.id);
      this.snack.open('User deactivated', 'Close', { duration: 2500 });
      await this.reload();
    } catch {
      this.snack.open('Failed to deactivate user', 'Close', { duration: 3000 });
    }
  }
}
