import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { AdminCategory } from '../../core/categories/categories.service';

export interface CategoryFormResult {
  name: string;
  description: string;
  isActive: boolean;
}

interface DialogData {
  category: AdminCategory | null;
}

@Component({
  selector: 'app-category-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit category' : 'Create category' }}</h2>
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
        padding-top: 0.75rem;
      }
    `,
  ],
})
export class CategoryFormDialog {
  protected readonly dialogRef = inject(MatDialogRef<CategoryFormDialog, CategoryFormResult>);
  private readonly data = inject<DialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.category;
  protected readonly name = signal(this.data.category?.name ?? '');
  protected readonly description = signal(this.data.category?.description ?? '');
  protected readonly isActive = signal(this.data.category?.isActive ?? true);

  protected canSave(): boolean {
    return this.name().trim().length >= 2;
  }

  protected save(): void {
    this.dialogRef.close({
      name: this.name().trim(),
      description: this.description().trim(),
      isActive: this.isActive(),
    });
  }
}
