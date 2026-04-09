import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { AdminTeam } from '../../core/teams/teams.service';
import { type AdminUser, UsersService } from '../../core/users/users.service';

export interface TeamFormResult {
  name: string;
  description: string;
  leadId: string | null;
  isActive: boolean;
}

interface DialogData {
  team: AdminTeam | null;
}

@Component({
  selector: 'app-team-form-dialog',
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
    <h2 mat-dialog-title>{{ isEdit ? 'Edit team' : 'Create team' }}</h2>
    <mat-dialog-content class="form">
      <mat-form-field appearance="outline">
        <mat-label>Name</mat-label>
        <input matInput [ngModel]="name()" (ngModelChange)="name.set($event)" required />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Description</mat-label>
        <textarea
          matInput
          rows="3"
          [ngModel]="description()"
          (ngModelChange)="description.set($event)"
        ></textarea>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Team lead</mat-label>
        <mat-select [value]="leadId()" (selectionChange)="leadId.set($event.value)">
          <mat-option [value]="null">— None —</mat-option>
          @for (u of leadCandidates(); track u.id) {
            <mat-option [value]="u.id">{{ u.fullName }} ({{ u.role }})</mat-option>
          }
        </mat-select>
        <mat-hint>Only ADMIN and TEAM_LEAD users can lead a team</mat-hint>
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
        min-width: 26rem;
        padding-top: 0.75rem;
      }
    `,
  ],
})
export class TeamFormDialog implements OnInit {
  protected readonly dialogRef = inject(MatDialogRef<TeamFormDialog, TeamFormResult>);
  private readonly data = inject<DialogData>(MAT_DIALOG_DATA);
  private readonly usersApi = inject(UsersService);

  protected readonly isEdit = !!this.data.team;
  protected readonly name = signal(this.data.team?.name ?? '');
  protected readonly description = signal(this.data.team?.description ?? '');
  protected readonly leadId = signal<string | null>(this.data.team?.leadId ?? null);
  protected readonly isActive = signal(this.data.team?.isActive ?? true);
  protected readonly leadCandidates = signal<AdminUser[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const users = await this.usersApi.list();
      this.leadCandidates.set(
        users.filter((u) => u.isActive && (u.role === 'ADMIN' || u.role === 'TEAM_LEAD')),
      );
    } catch {
      this.leadCandidates.set([]);
    }
  }

  protected canSave(): boolean {
    return this.name().trim().length >= 2;
  }

  protected save(): void {
    this.dialogRef.close({
      name: this.name().trim(),
      description: this.description().trim(),
      leadId: this.leadId(),
      isActive: this.isActive(),
    });
  }
}
