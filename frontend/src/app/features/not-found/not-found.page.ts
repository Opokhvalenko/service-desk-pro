import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <main class="nf-shell">
      <div class="nf-card">
        <mat-icon class="nf-icon">search_off</mat-icon>
        <h1 class="nf-code">404</h1>
        <p class="nf-title">Page not found</p>
        <p class="nf-sub">
          The page you are looking for does not exist or has been moved.
        </p>
        <div class="nf-actions">
          <button mat-flat-button color="primary" type="button" (click)="goHome()">
            <mat-icon>home</mat-icon>
            Go to tickets
          </button>
          <button mat-stroked-button type="button" (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
            Back
          </button>
        </div>
      </div>
    </main>
  `,
  styles: `
    .nf-shell {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100dvh;
      padding: 1.5rem;
      background: linear-gradient(135deg, #eef2ff 0%, #ecfeff 100%);
    }
    .nf-card {
      background: #fff;
      border-radius: 1rem;
      padding: 2.5rem 2rem;
      max-width: 28rem;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 50px -20px rgb(15 23 42 / 25%);
    }
    .nf-icon {
      font-size: 3.5rem;
      width: 3.5rem;
      height: 3.5rem;
      color: #6366f1;
    }
    .nf-code {
      font-size: 3rem;
      margin: 0.5rem 0 0.25rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #1e293b;
    }
    .nf-title {
      font-size: 1.15rem;
      font-weight: 600;
      color: #334155;
      margin: 0 0 0.5rem;
    }
    .nf-sub {
      color: #64748b;
      margin: 0 0 1.5rem;
      line-height: 1.5;
    }
    .nf-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      flex-wrap: wrap;
    }
  `,
})
export class NotFoundPage {
  private readonly router = inject(Router);

  protected goHome(): void {
    void this.router.navigate(['/tickets']);
  }

  protected goBack(): void {
    history.length > 1 ? history.back() : this.goHome();
  }
}
