import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import type {
  CreateTicketDto,
  ListTicketsQuery,
  Ticket,
  TicketStatus,
  UpdateTicketDto,
} from './ticket.types';
import { TicketsService } from './tickets.service';

interface TicketsState {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  query: ListTicketsQuery;
  loading: boolean;
  error: string | null;
  current: Ticket | null;
  currentLoading: boolean;
}

const initialState: TicketsState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
  query: { page: 1, pageSize: 20 },
  loading: false,
  error: null,
  current: null,
  currentLoading: false,
};

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Request failed';
}

export const TicketsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, api = inject(TicketsService)) => ({
    async loadList(query: ListTicketsQuery = store.query()): Promise<void> {
      patchState(store, { loading: true, error: null, query });
      try {
        const res = await api.list(query);
        patchState(store, {
          items: res.items,
          total: res.total,
          page: res.page,
          pageSize: res.pageSize,
          totalPages: res.totalPages,
          loading: false,
        });
      } catch (err) {
        patchState(store, { loading: false, error: errorMessage(err) });
      }
    },

    async loadOne(id: string): Promise<void> {
      patchState(store, { currentLoading: true, error: null });
      try {
        const ticket = await api.get(id);
        patchState(store, { current: ticket, currentLoading: false });
      } catch (err) {
        patchState(store, { currentLoading: false, error: errorMessage(err) });
      }
    },

    clearCurrent(): void {
      patchState(store, { current: null });
    },

    async create(dto: CreateTicketDto): Promise<Ticket | null> {
      try {
        const ticket = await api.create(dto);
        patchState(store, { items: [ticket, ...store.items()], total: store.total() + 1 });
        return ticket;
      } catch (err) {
        patchState(store, { error: errorMessage(err) });
        return null;
      }
    },

    async update(id: string, dto: UpdateTicketDto): Promise<boolean> {
      try {
        const updated = await api.update(id, dto);
        patchState(store, {
          items: store.items().map((t) => (t.id === id ? { ...t, ...updated } : t)),
          current:
            store.current()?.id === id ? { ...store.current(), ...updated } : store.current(),
        });
        return true;
      } catch (err) {
        patchState(store, { error: errorMessage(err) });
        return false;
      }
    },

    async changeStatus(id: string, status: TicketStatus): Promise<void> {
      try {
        const updated = await api.changeStatus(id, status);
        patchState(store, {
          items: store.items().map((t) => (t.id === id ? { ...t, ...updated } : t)),
          current:
            store.current()?.id === id ? { ...store.current(), ...updated } : store.current(),
        });
      } catch (err) {
        patchState(store, { error: errorMessage(err) });
      }
    },

    async assign(id: string, assigneeId: string | null): Promise<void> {
      try {
        const updated = await api.assign(id, assigneeId);
        patchState(store, {
          items: store.items().map((t) => (t.id === id ? { ...t, ...updated } : t)),
          current:
            store.current()?.id === id ? { ...store.current(), ...updated } : store.current(),
        });
      } catch (err) {
        patchState(store, { error: errorMessage(err) });
      }
    },

    async addComment(id: string, body: string, isInternal = false): Promise<void> {
      try {
        const comment = await api.addComment(id, body, isInternal);
        const current = store.current();
        if (current?.id === id) {
          patchState(store, {
            current: { ...current, comments: [...(current.comments ?? []), comment] },
          });
        }
      } catch (err) {
        patchState(store, { error: errorMessage(err) });
      }
    },

    /** Called by realtime service when a ticket changes externally. */
    async refreshTicket(id: string): Promise<void> {
      if (store.current()?.id !== id) return;
      try {
        const fresh = await api.get(id);
        patchState(store, { current: fresh });
      } catch {
        // ignore
      }
    },

    clearError(): void {
      patchState(store, { error: null });
    },
  })),
);
