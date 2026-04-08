import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { UserRole } from '../../core/auth/auth.types';
import type { AdminUser } from '../../core/users/users.service';

export interface UserFormResult {
  email?: string;
  password?: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

interface DialogData {
  user: AdminUser | null;
}

const ROLES: UserRole[] = ['ADMIN', 'TEAM_LEAD', 'AGENT', 'REQUESTER'];

@Component({
  selector: 'app-user-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit user' : 'Create user' }}</h2>
    <mat-dialog-content class="form">
      @if (!isEdit) {
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input
            matInput
            type="email"
            [ngModel]="email()"
            (ngModelChange)="email.set($event)"
            required
          />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Temporary password</mat-label>
          <input
            matInput
            type="text"
            minlength="8"
            [ngModel]="password()"
            (ngModelChange)="password.set($event)"
            required
          />
          <mat-hint>Min 8 chars. User can change later.</mat-hint>
        </mat-form-field>
      }
      <mat-form-field appearance="outline">
        <mat-label>Full name</mat-label>
        <input
          matInput
          [ngModel]="fullName()"
          (ngModelChange)="fullName.set($event)"
          required
        />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Role</mat-label>
        <mat-select [value]="role()" (selectionChange)="role.set($event.value)">
          @for (r of roles; track r) {
            <mat-option [value]="r">{{ r }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-slide-toggle [checked]="isActive()" (change)="isActive.set($event.checked)">
        Active
      </mat-slide-toggle>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        [disabled]="!canSave()"
        (click)="save()"
      >
        <mat-icon>save</mat-icon>
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-width: 24rem;
      }
    `,
  ],
})
export class UserFormDialog {
  protected readonly dialogRef = inject(MatDialogRef<UserFormDialog, UserFormResult>);
  private readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  protected readonly roles = ROLES;
  protected readonly isEdit = !!this.data.user;

  protected readonly email = signal(this.data.user?.email ?? '');
  protected readonly password = signal('');
  protected readonly fullName = signal(this.data.user?.fullName ?? '');
  protected readonly role = signal<UserRole>(this.data.user?.role ?? 'AGENT');
  protected readonly isActive = signal<boolean>(this.data.user?.isActive ?? true);

  protected canSave(): boolean {
    if (!this.fullName().trim()) return false;
    if (this.isEdit) return true;
    return /\S+@\S+\.\S+/.test(this.email()) && this.password().length >= 8;
  }

  protected save(): void {
    this.dialogRef.close({
      email: this.isEdit ? undefined : this.email().trim(),
      password: this.isEdit ? undefined : this.password(),
      fullName: this.fullName().trim(),
      role: this.role(),
      isActive: this.isActive(),
    });
  }
}
