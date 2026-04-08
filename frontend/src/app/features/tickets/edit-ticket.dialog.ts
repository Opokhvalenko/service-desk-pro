import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  TICKET_PRIORITIES,
  type Ticket,
  type TicketPriority,
} from '../../core/tickets/ticket.types';
import { TicketsStore } from '../../core/tickets/tickets.store';

@Component({
  selector: 'app-edit-ticket-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit ticket {{ data.code }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="dialog-content">
        <mat-form-field appearance="outline">
          <mat-label>Title</mat-label>
          <input matInput formControlName="title" maxlength="200" required />
          <mat-hint align="end">{{ form.controls.title.value.length }}/200</mat-hint>
          @if (form.controls.title.touched && form.controls.title.errors; as e) {
            @if (e['required']) {
              <mat-error>Title is required</mat-error>
            } @else if (e['minlength']) {
              <mat-error>Minimum 3 characters</mat-error>
            }
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            rows="6"
            maxlength="10000"
            required
          ></textarea>
          <mat-hint align="end">{{ form.controls.description.value.length }}/10000</mat-hint>
          @if (form.controls.description.touched && form.controls.description.errors; as e) {
            @if (e['required']) {
              <mat-error>Description is required</mat-error>
            } @else if (e['minlength']) {
              <mat-error>Minimum 10 characters</mat-error>
            }
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority" required>
            @for (p of priorities; track p) {
              <mat-option [value]="p">{{ p }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" type="submit">Save changes</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .dialog-content {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.5rem;
      min-width: 26rem;
    }
  `,
})
export class EditTicketDialog {
  protected readonly dialogRef = inject(MatDialogRef<EditTicketDialog>);
  protected readonly data = inject<Ticket>(MAT_DIALOG_DATA);
  private readonly store = inject(TicketsStore);
  private readonly fb = inject(FormBuilder);

  protected readonly priorities = TICKET_PRIORITIES;

  protected readonly form = this.fb.nonNullable.group({
    title: [
      this.data.title,
      [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    ],
    description: [
      this.data.description,
      [Validators.required, Validators.minLength(10), Validators.maxLength(10000)],
    ],
    priority: [this.data.priority as TicketPriority, Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const ok = await this.store.update(this.data.id, this.form.getRawValue());
    if (ok) this.dialogRef.close(true);
  }
}
