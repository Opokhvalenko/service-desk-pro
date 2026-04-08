import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  type OnDestroy,
  type OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AuthStore } from '../../core/auth/auth.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { TICKET_TRANSITIONS, type TicketStatus } from '../../core/tickets/ticket.types';
import { TicketsService } from '../../core/tickets/tickets.service';
import { TicketsStore } from '../../core/tickets/tickets.store';
import { AppToolbarComponent } from '../../shared/app-toolbar/app-toolbar.component';

interface QuickAction {
  label: string;
  icon: string;
  kind: 'claim' | 'status';
  target?: TicketStatus;
}

@Component({
  selector: 'app-ticket-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    AppToolbarComponent,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './ticket-detail.page.html',
  styleUrl: './ticket-detail.page.scss',
})
export class TicketDetailPage implements OnInit, OnDestroy {
  /** Bound from route param via withComponentInputBinding(). */
  readonly id = input.required<string>();

  protected readonly store = inject(TicketsStore);
  protected readonly auth = inject(AuthStore);
  private readonly realtime = inject(RealtimeService);
  private readonly api = inject(TicketsService);

  protected readonly newComment = signal('');
  protected readonly internalNote = signal(false);
  protected readonly assignableUsers = signal<
    Array<{ id: string; fullName: string; email: string; role: string }>
  >([]);

  protected readonly ticket = computed(() => this.store.current());

  protected readonly availableTransitions = computed<TicketStatus[]>(() => {
    const t = this.ticket();
    return t ? TICKET_TRANSITIONS[t.status] : [];
  });

  protected readonly canPostInternal = computed(() => {
    const role = this.auth.role();
    return role === 'AGENT' || role === 'TEAM_LEAD' || role === 'ADMIN';
  });

  protected readonly canChangeStatus = computed(() => {
    const role = this.auth.role();
    return role !== null && role !== 'REQUESTER';
  });

  protected readonly canReopen = computed(() => {
    const t = this.ticket();
    const me = this.auth.user();
    if (!t || !me) return false;
    if (this.auth.role() !== 'REQUESTER') return false;
    if (t.createdBy.id !== me.id) return false;
    return t.status === 'RESOLVED' || t.status === 'CLOSED';
  });

  protected readonly isReadOnlyForRequester = computed(() => {
    if (this.auth.role() !== 'REQUESTER') return false;
    const t = this.ticket();
    return !!t && (t.status === 'RESOLVED' || t.status === 'CLOSED');
  });

  /** Suggested next-step actions based on role + current status. */
  protected readonly quickActions = computed<QuickAction[]>(() => {
    const t = this.ticket();
    const role = this.auth.role();
    const me = this.auth.user();
    if (!t || !role || role === 'REQUESTER') return [];

    const isAssignedToMe = !!me && t.assignee?.id === me.id;
    const out: QuickAction[] = [];

    if (!t.assignee) {
      out.push({ label: 'Take ticket', icon: 'pan_tool', kind: 'claim' });
    }

    switch (t.status) {
      case 'NEW':
        out.push({ label: 'Open', icon: 'lock_open', kind: 'status', target: 'OPEN' });
        out.push({
          label: 'Start work',
          icon: 'play_arrow',
          kind: 'status',
          target: 'IN_PROGRESS',
        });
        break;
      case 'OPEN':
        out.push({
          label: 'Start work',
          icon: 'play_arrow',
          kind: 'status',
          target: 'IN_PROGRESS',
        });
        out.push({
          label: 'Wait for customer',
          icon: 'hourglass_top',
          kind: 'status',
          target: 'WAITING_FOR_CUSTOMER',
        });
        break;
      case 'IN_PROGRESS':
        out.push({ label: 'Resolve', icon: 'check_circle', kind: 'status', target: 'RESOLVED' });
        out.push({
          label: 'Wait for customer',
          icon: 'hourglass_top',
          kind: 'status',
          target: 'WAITING_FOR_CUSTOMER',
        });
        if (role === 'TEAM_LEAD' || role === 'ADMIN') {
          out.push({
            label: 'Escalate',
            icon: 'priority_high',
            kind: 'status',
            target: 'ESCALATED',
          });
        }
        break;
      case 'WAITING_FOR_CUSTOMER':
        out.push({
          label: 'Resume work',
          icon: 'play_arrow',
          kind: 'status',
          target: 'IN_PROGRESS',
        });
        out.push({ label: 'Resolve', icon: 'check_circle', kind: 'status', target: 'RESOLVED' });
        break;
      case 'ESCALATED':
        out.push({
          label: 'Resume work',
          icon: 'play_arrow',
          kind: 'status',
          target: 'IN_PROGRESS',
        });
        out.push({ label: 'Resolve', icon: 'check_circle', kind: 'status', target: 'RESOLVED' });
        break;
      case 'RESOLVED':
        out.push({ label: 'Close ticket', icon: 'lock', kind: 'status', target: 'CLOSED' });
        break;
      case 'REOPENED':
        out.push({
          label: 'Start work',
          icon: 'play_arrow',
          kind: 'status',
          target: 'IN_PROGRESS',
        });
        break;
    }

    return out.filter((a) => !(a.kind === 'claim' && isAssignedToMe));
  });

  protected async runQuickAction(action: QuickAction): Promise<void> {
    if (action.kind === 'claim') {
      await this.claimSelf();
      return;
    }
    if (action.kind === 'status' && action.target) {
      await this.store.changeStatus(this.id(), action.target);
    }
  }

  protected async reopen(): Promise<void> {
    await this.store.changeStatus(this.id(), 'REOPENED');
  }

  protected readonly canAssign = computed(() => {
    const role = this.auth.role();
    return role === 'AGENT' || role === 'TEAM_LEAD' || role === 'ADMIN';
  });

  ngOnInit(): void {
    void this.store.loadOne(this.id());
    this.realtime.joinTicket(this.id());
    if (this.canAssign()) {
      void this.api.assignableUsers().then((users) => this.assignableUsers.set(users));
    }
  }

  ngOnDestroy(): void {
    this.realtime.leaveTicket(this.id());
    this.store.clearCurrent();
  }

  protected async onStatusChange(status: TicketStatus): Promise<void> {
    await this.store.changeStatus(this.id(), status);
  }

  protected async onAssigneeChange(assigneeId: string | null): Promise<void> {
    await this.store.assign(this.id(), assigneeId);
  }

  protected async claimSelf(): Promise<void> {
    const me = this.auth.user();
    if (me) await this.store.assign(this.id(), me.id);
  }

  protected async submitComment(): Promise<void> {
    const body = this.newComment().trim();
    if (!body) return;
    await this.store.addComment(this.id(), body, this.internalNote());
    this.newComment.set('');
    this.internalNote.set(false);
  }
}
