import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { type AdminTeam, TeamsService } from '../../core/teams/teams.service';
import { TeamFormDialog, type TeamFormResult } from './team-form.dialog';

@Component({
  selector: 'app-admin-teams-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card appearance="outlined" class="page-card">
      <header class="page-head">
        <div>
          <h1>Teams</h1>
          <p class="subtitle">Group agents into support teams</p>
        </div>
        <button mat-flat-button color="primary" type="button" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          New team
        </button>
      </header>

      @if (loading()) {
        <div class="state"><mat-spinner diameter="36" /></div>
      } @else if (error()) {
        <div class="state error">{{ error() }}</div>
      } @else if (teams().length === 0) {
        <div class="state">No teams yet.</div>
      } @else {
        <table mat-table [dataSource]="teams()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let t">
              <div class="name">{{ t.name }}</div>
              @if (t.description) {
                <div class="desc">{{ t.description }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="lead">
            <th mat-header-cell *matHeaderCellDef>Lead</th>
            <td mat-cell *matCellDef="let t">
              {{ t.lead?.fullName || '—' }}
            </td>
          </ng-container>
          <ng-container matColumnDef="counts">
            <th mat-header-cell *matHeaderCellDef>Members / Tickets</th>
            <td mat-cell *matCellDef="let t">
              {{ t._count.members }} / {{ t._count.tickets }}
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let t">
              @if (t.isActive) {
                <span class="status active">Active</span>
              } @else {
                <span class="status inactive">Inactive</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let t" class="actions-col">
              <button mat-icon-button type="button" aria-label="Edit" (click)="openEdit(t)">
                <mat-icon>edit</mat-icon>
              </button>
              @if (t.isActive) {
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Deactivate"
                  (click)="deactivate(t)"
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
      .data-table {
        width: 100%;
        background: transparent;
      }
      .data-table .mat-column-name {
        min-width: 16rem;
      }
      .name {
        font-weight: 600;
        color: #1e293b;
      }
      .desc {
        font-size: 0.78rem;
        color: #64748b;
        margin-top: 0.15rem;
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
export class AdminTeamsPage implements OnInit {
  private readonly api = inject(TeamsService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly teams = signal<AdminTeam[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly columns = ['name', 'lead', 'counts', 'status', 'actions'];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.teams.set(await this.api.list());
    } catch {
      this.error.set('Failed to load teams');
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreate(): void {
    const ref = this.dialog.open(TeamFormDialog, {
      width: '30rem',
      data: { team: null },
    });
    ref.afterClosed().subscribe(async (result: TeamFormResult | undefined) => {
      if (!result) return;
      try {
        await this.api.create({
          name: result.name,
          description: result.description || undefined,
          leadId: result.leadId ?? undefined,
          isActive: result.isActive,
        });
        this.snack.open('Team created', 'Close', { duration: 2500 });
        await this.reload();
      } catch {
        this.snack.open('Failed to create team', 'Close', { duration: 3000 });
      }
    });
  }

  protected openEdit(team: AdminTeam): void {
    const ref = this.dialog.open(TeamFormDialog, {
      width: '30rem',
      data: { team },
    });
    ref.afterClosed().subscribe(async (result: TeamFormResult | undefined) => {
      if (!result) return;
      try {
        await this.api.update(team.id, {
          name: result.name,
          description: result.description || undefined,
          leadId: result.leadId,
          isActive: result.isActive,
        });
        this.snack.open('Team updated', 'Close', { duration: 2500 });
        await this.reload();
      } catch {
        this.snack.open('Failed to update team', 'Close', { duration: 3000 });
      }
    });
  }

  protected async deactivate(team: AdminTeam): Promise<void> {
    if (!confirm(`Deactivate ${team.name}?`)) return;
    try {
      await this.api.deactivate(team.id);
      this.snack.open('Team deactivated', 'Close', { duration: 2500 });
      await this.reload();
    } catch {
      this.snack.open('Failed to deactivate team', 'Close', { duration: 3000 });
    }
  }
}
