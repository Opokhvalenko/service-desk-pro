import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AppToolbarComponent } from '../../shared/app-toolbar/app-toolbar.component';

@Component({
  selector: 'app-admin-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, AppToolbarComponent],
  template: `
    <app-toolbar active="admin" />
    <div class="admin-shell">
      <aside class="admin-side">
        <h2 class="side-title">Admin</h2>
        <nav class="side-nav">
          <a routerLink="/admin/users" routerLinkActive="active" class="side-link">
            <mat-icon>group</mat-icon>
            <span>Users</span>
          </a>
          <a routerLink="/admin/categories" routerLinkActive="active" class="side-link">
            <mat-icon>category</mat-icon>
            <span>Categories</span>
          </a>
          <a routerLink="/admin/teams" routerLinkActive="active" class="side-link">
            <mat-icon>groups</mat-icon>
            <span>Teams</span>
          </a>
          <a routerLink="/admin/sla" routerLinkActive="active" class="side-link">
            <mat-icon>schedule</mat-icon>
            <span>SLA policies</span>
          </a>
          <a routerLink="/admin/audit-log" routerLinkActive="active" class="side-link">
            <mat-icon>history</mat-icon>
            <span>Audit log</span>
          </a>
        </nav>
      </aside>
      <main class="admin-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .admin-shell {
        display: grid;
        grid-template-columns: 14rem 1fr;
        gap: 1.5rem;
        padding: 1.5rem;
        max-width: 90rem;
        margin: 0 auto;
      }
      .admin-side {
        background: #fff;
        border: 1px solid rgb(226 232 240 / 80%);
        border-radius: 1rem;
        padding: 1.25rem;
        height: fit-content;
      }
      .side-title {
        margin: 0 0 0.85rem;
        font-size: 0.85rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
      }
      .side-nav {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .side-link {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.6rem 0.8rem;
        border-radius: 0.5rem;
        color: #334155;
        text-decoration: none;
        font-weight: 600;
        font-size: 0.9rem;
        transition: background-color 0.18s ease, color 0.18s ease;
      }
      .side-link:hover {
        background: #f1f5f9;
        color: #1e293b;
      }
      .side-link.active {
        background: #eef2ff;
        color: #4338ca;
      }
      .side-link mat-icon {
        font-size: 1.15rem;
        width: 1.15rem;
        height: 1.15rem;
      }
      @media (max-width: 768px) {
        .admin-shell {
          grid-template-columns: 1fr;
          padding: 1rem;
        }
      }
    `,
  ],
})
export class AdminLayoutComponent {}
