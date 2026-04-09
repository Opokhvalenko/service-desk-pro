import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  type OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '../../core/tickets/ticket.types';
import { TicketsStore } from '../../core/tickets/tickets.store';
import { AppToolbarComponent } from '../../shared/app-toolbar/app-toolbar.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { CreateTicketDialog } from './create-ticket.dialog';

type ListMode = 'all' | 'queue' | 'my';

@Component({
  selector: 'app-tickets-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    AppToolbarComponent,
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
    SkeletonComponent,
  ],
  templateUrl: './tickets-list.page.html',
  styleUrl: './tickets-list.page.scss',
})
export class TicketsListPage implements OnInit {
  protected readonly store = inject(TicketsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mode = signal<ListMode>('all');
  protected readonly pageTitle = signal<string>('Tickets');

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
  protected readonly activeFilterLabel = signal<string | null>(null);

  ngOnInit(): void {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      const m = (data as { mode?: ListMode }).mode ?? 'all';
      this.mode.set(m);
      this.pageTitle.set(
        m === 'queue' ? 'Unassigned queue' : m === 'my' ? 'My tickets' : 'Tickets',
      );
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const status = params.get('status') as TicketStatus | null;
      const statusIn = params.get('statusIn');
      const breached = params.get('breached') === 'true';
      const priority = params.get('priority') as TicketPriority | null;
      const search = params.get('search');
      this.statusFilter.set(status ?? '');
      this.priorityFilter.set(priority ?? '');
      this.searchValue.set(search ?? '');

      // Compute human-readable label for active multi/breached filters
      let label: string | null = null;
      if (breached) label = 'SLA breached only';
      else if (statusIn) label = `Active statuses (${statusIn.split(',').length})`;
      this.activeFilterLabel.set(label);

      const m = this.mode();
      const currentUserId = this.auth.user()?.id;
      void this.store.loadList({
        page: 1,
        pageSize: 20,
        status: status ?? undefined,
        statusIn: statusIn ?? undefined,
        breached: breached || undefined,
        priority: priority ?? undefined,
        search: search ?? undefined,
        unassigned: m === 'queue' ? true : undefined,
        assigneeId: m === 'my' && currentUserId ? currentUserId : undefined,
      });
    });
  }

  protected applyFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status: this.statusFilter() || null,
        priority: this.priorityFilter() || null,
        search: this.searchValue() || null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected resetFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
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
    ref
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((created) => {
        if (created) void this.store.loadList(this.store.query());
      });
  }

  protected statusClass(status: TicketStatus): string {
    return `status-chip status-${status.toLowerCase().replace(/_/g, '-')}`;
  }

  protected priorityClass(priority: TicketPriority): string {
    return `priority-chip priority-${priority.toLowerCase()}`;
  }
}
