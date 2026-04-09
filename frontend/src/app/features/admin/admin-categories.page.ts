import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { type AdminCategory, CategoriesService } from '../../core/categories/categories.service';
import { CategoryFormDialog, type CategoryFormResult } from './category-form.dialog';

@Component({
  selector: 'app-admin-categories-page',
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
          <h1>Categories</h1>
          <p class="subtitle">Group tickets by topic</p>
        </div>
        <button mat-flat-button color="primary" type="button" (click)="openCreate()">
          <mat-icon>add</mat-icon>
          New category
        </button>
      </header>

      @if (loading()) {
        <div class="state"><mat-spinner diameter="36" /></div>
      } @else if (error()) {
        <div class="state error">{{ error() }}</div>
      } @else if (categories().length === 0) {
        <div class="state">No categories yet.</div>
      } @else {
        <table mat-table [dataSource]="categories()" class="data-table">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let c">
              <div class="name">{{ c.name }}</div>
              @if (c.description) {
                <div class="desc">{{ c.description }}</div>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let c">
              @if (c.isActive) {
                <span class="status active">Active</span>
              } @else {
                <span class="status inactive">Inactive</span>
              }
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="actions-col"></th>
            <td mat-cell *matCellDef="let c" class="actions-col">
              <button mat-icon-button type="button" aria-label="Edit" (click)="openEdit(c)">
                <mat-icon>edit</mat-icon>
              </button>
              @if (c.isActive) {
                <button
                  mat-icon-button
                  type="button"
                  aria-label="Deactivate"
                  (click)="deactivate(c)"
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
        background: var(--mat-sys-surface-container) !important;
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
        color: var(--mat-sys-on-surface);
      }
      .subtitle {
        margin: 0.2rem 0 0;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.85rem;
      }
      .state {
        padding: 2rem;
        text-align: center;
        color: var(--mat-sys-on-surface-variant);
      }
      .state.error {
        color: #b91c1c;
      }
      .data-table {
        width: 100%;
        background: transparent;
      }
      .data-table .mat-column-name {
        min-width: 18rem;
      }
      .name {
        font-weight: 600;
        color: var(--mat-sys-on-surface);
      }
      .desc {
        font-size: 0.78rem;
        color: var(--mat-sys-on-surface-variant);
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
        color: var(--mat-sys-on-surface-variant);
      }
      .actions-col {
        width: 6rem;
        text-align: right;
      }
    `,
  ],
})
export class AdminCategoriesPage implements OnInit {
  private readonly api = inject(CategoriesService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  protected readonly categories = signal<AdminCategory[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly columns = ['name', 'status', 'actions'];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.categories.set(await this.api.list());
    } catch {
      this.error.set('Failed to load categories');
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreate(): void {
    const ref = this.dialog.open(CategoryFormDialog, {
      width: '28rem',
      data: { category: null },
    });
    ref.afterClosed().subscribe(async (result: CategoryFormResult | undefined) => {
      if (!result) return;
      try {
        await this.api.create({
          name: result.name,
          description: result.description || undefined,
          isActive: result.isActive,
        });
        this.snack.open('Category created', 'Close', { duration: 2500 });
        await this.reload();
      } catch {
        this.snack.open('Failed to create category', 'Close', { duration: 3000 });
      }
    });
  }

  protected openEdit(category: AdminCategory): void {
    const ref = this.dialog.open(CategoryFormDialog, {
      width: '28rem',
      data: { category },
    });
    ref.afterClosed().subscribe(async (result: CategoryFormResult | undefined) => {
      if (!result) return;
      try {
        await this.api.update(category.id, {
          name: result.name,
          description: result.description || undefined,
          isActive: result.isActive,
        });
        this.snack.open('Category updated', 'Close', { duration: 2500 });
        await this.reload();
      } catch {
        this.snack.open('Failed to update category', 'Close', { duration: 3000 });
      }
    });
  }

  protected async deactivate(category: AdminCategory): Promise<void> {
    if (!confirm(`Deactivate ${category.name}?`)) return;
    try {
      await this.api.deactivate(category.id);
      this.snack.open('Category deactivated', 'Close', { duration: 2500 });
      await this.reload();
    } catch {
      this.snack.open('Failed to deactivate category', 'Close', { duration: 3000 });
    }
  }
}
