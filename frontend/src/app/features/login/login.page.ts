import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  protected readonly store = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  protected readonly hidePassword = signal(true);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly demoAccounts = [
    { email: 'admin@servicedesk.com', label: 'Admin' },
    { email: 'lead@servicedesk.com', label: 'Team Lead' },
    { email: 'agent@servicedesk.com', label: 'Agent' },
    { email: 'user@servicedesk.com', label: 'Requester' },
  ] as const;

  protected fillDemo(email: string): void {
    this.form.patchValue({ email, password: 'password123' });
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      await this.store.login(this.form.getRawValue());
    } catch {
      // error already in store.error()
    }
  }

  protected togglePassword(): void {
    this.hidePassword.update((v) => !v);
  }
}
