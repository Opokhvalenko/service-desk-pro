import {
  Directive,
  type EmbeddedViewRef,
  effect,
  Input,
  inject,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import type { UserRole } from '../../core/auth/auth.types';

/**
 * Permission keys used across the app. Maps to one or more roles.
 * Centralising this avoids scattering role checks in templates.
 */
export type Permission =
  | 'ticket.assign'
  | 'ticket.delete'
  | 'ticket.escalate'
  | 'ticket.viewInternal'
  | 'admin.access'
  | 'reports.view'
  | 'queue.view';

const PERMISSION_MATRIX: Record<Permission, readonly UserRole[]> = {
  'ticket.assign': ['ADMIN', 'TEAM_LEAD'],
  'ticket.delete': ['ADMIN'],
  'ticket.escalate': ['ADMIN', 'TEAM_LEAD', 'AGENT'],
  'ticket.viewInternal': ['ADMIN', 'TEAM_LEAD', 'AGENT'],
  'admin.access': ['ADMIN'],
  'reports.view': ['ADMIN', 'TEAM_LEAD'],
  'queue.view': ['ADMIN', 'TEAM_LEAD', 'AGENT'],
};

/**
 * Structural directive: renders the template only if the current user has
 * the given permission. Permissions are mapped to roles centrally so the
 * matrix can evolve without touching templates.
 *
 * Usage:
 *   <button *hasPermission="'ticket.assign'">Assign</button>
 */
@Directive({
  selector: '[hasPermission]',
})
export class HasPermissionDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthStore);

  private permission: Permission | null = null;
  private viewRef: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    // `effect()` created in an injection context (constructor of an
    // @Injectable / @Directive) is automatically destroyed when the host
    // directive is destroyed via the ambient `DestroyRef`. No manual
    // unsubscribe / takeUntilDestroyed needed.
    effect(() => {
      const role = this.auth.role();
      const allowed =
        this.permission !== null &&
        role !== null &&
        PERMISSION_MATRIX[this.permission].includes(role);
      if (allowed && !this.viewRef) {
        this.viewRef = this.vcr.createEmbeddedView(this.tpl);
      } else if (!allowed && this.viewRef) {
        this.vcr.clear();
        this.viewRef = null;
      }
    });
  }

  @Input()
  set hasPermission(value: Permission) {
    this.permission = value;
  }
}
