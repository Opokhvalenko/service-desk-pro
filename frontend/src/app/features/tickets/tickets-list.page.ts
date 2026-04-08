import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, type OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '../../core/tickets/ticket.types';
import { TicketsStore } from '../../core/tickets/tickets.store';
import { CreateTicketDialog } from './create-ticket.dialog';

@Component({
  selector: 'app-tickets-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  templateUrl: './tickets-list.page.html',
  styleUrl: './tickets-list.page.scss',
})
export class TicketsListPage implements OnInit {
  protected readonly store = inject(TicketsStore);
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  protected readonly statuses = TICKET_STATUSES;
  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly displayedColumns = [
    'code',
    'title',
    'status',
    'priority',
    'assignee',
    'created',
  ];

  protected readonly statusFilter = signal<TicketStatus | ''>('');
  protected readonly priorityFilter = signal<TicketPriority | ''>('');
  protected readonly searchValue = signal('');

  ngOnInit(): void {
    void this.store.loadList({ page: 1, pageSize: 20 });
  }

  protected applyFilters(): void {
    void this.store.loadList({
      page: 1,
      pageSize: this.store.pageSize(),
      status: this.statusFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      search: this.searchValue() || undefined,
    });
  }

  protected resetFilters(): void {
    this.statusFilter.set('');
    this.priorityFilter.set('');
    this.searchValue.set('');
    void this.store.loadList({ page: 1, pageSize: 20 });
  }

  protected onPage(event: PageEvent): void {
    void this.store.loadList({
      ...this.store.query(),
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  protected openTicket(id: string): void {
    void this.router.navigate(['/tickets', id]);
  }

  protected openCreateDialog(): void {
    const ref = this.dialog.open(CreateTicketDialog, { width: '32rem' });
    ref.afterClosed().subscribe((created) => {
      if (created) void this.store.loadList(this.store.query());
    });
  }

  protected logout(): void {
    void this.auth.logout();
  }

  protected statusClass(status: TicketStatus): string {
    return `status-chip status-${status.toLowerCase().replace('_', '-')}`;
  }

  protected priorityClass(priority: TicketPriority): string {
    return `priority-chip priority-${priority.toLowerCase()}`;
  }
}
