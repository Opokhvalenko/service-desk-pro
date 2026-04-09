import type { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'tickets',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/tickets-list.page').then((m) => m.TicketsListPage),
  },
  {
    path: 'tickets/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/tickets/ticket-detail.page').then((m) => m.TicketDetailPage),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard(['ADMIN'])],
    loadComponent: () =>
      import('./features/admin/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'users' },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/admin-users.page').then((m) => m.AdminUsersPage),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/admin/admin-categories.page').then((m) => m.AdminCategoriesPage),
      },
      {
        path: 'teams',
        loadComponent: () =>
          import('./features/admin/admin-teams.page').then((m) => m.AdminTeamsPage),
      },
      {
        path: 'sla',
        loadComponent: () => import('./features/admin/admin-sla.page').then((m) => m.AdminSlaPage),
      },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'tickets' },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.page').then((m) => m.NotFoundPage),
  },
];
