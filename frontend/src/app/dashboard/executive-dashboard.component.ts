import { Component, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/http/api.service';
import { DashboardItem, ExecutiveDashboard } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

@Component({
  selector: 'kravia-executive-dashboard',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './executive-dashboard.component.html'
})
export class ExecutiveDashboardComponent {
  private readonly api = inject(ApiService);

  readonly dashboard = signal<ExecutiveDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.executiveDashboard().subscribe({
      next: (dashboard) => this.dashboard.set(dashboard),
      error: () => this.error.set('Unable to load executive dashboard.'),
      complete: () => this.loading.set(false)
    });
  }

  formatMoney(value?: number): string {
    if (value === undefined || value === null) return 'No information has been added yet.';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  }

  formatDate(value?: string): string {
    if (!value) return 'No information has been added yet.';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
  }

  routeFor(item: DashboardItem): string | null {
    const routes: Record<string, string> = {
      COMPLIANCE: '/compliance',
      BOARD_MEETINGS: '/board-meetings',
      TASKS: '/tasks',
      DOCUMENTS: '/documents',
      NOTIFICATIONS: '/notifications',
      WORKFLOW: '/dashboard'
    };
    return routes[item.module] ?? null;
  }
}
