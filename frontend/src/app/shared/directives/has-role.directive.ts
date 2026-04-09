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
 * Structural directive: renders the template only if the current user's role
 * is included in the provided list.
 *
 * Usage:
 *   <button *hasRole="['ADMIN', 'TEAM_LEAD']">Manage</button>
 */
@Directive({
  selector: '[hasRole]',
})
export class HasRoleDirective {
  private readonly tpl = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);
  private readonly auth = inject(AuthStore);

  private allowed: readonly UserRole[] = [];
  private viewRef: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const role = this.auth.role();
      const shouldRender = role !== null && this.allowed.includes(role);
      if (shouldRender && !this.viewRef) {
        this.viewRef = this.vcr.createEmbeddedView(this.tpl);
      } else if (!shouldRender && this.viewRef) {
        this.vcr.clear();
        this.viewRef = null;
      }
    });
  }

  @Input()
  set hasRole(roles: UserRole | readonly UserRole[]) {
    this.allowed = Array.isArray(roles) ? roles : [roles as UserRole];
  }
}
