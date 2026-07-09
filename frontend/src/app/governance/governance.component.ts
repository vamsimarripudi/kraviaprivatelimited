import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../core/http/api.service';
import { AccessReviewRecord, GovernanceDashboard } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

@Component({
  selector: 'kravia-governance',
  standalone: true,
  imports: [EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './governance.component.html'
})
export class GovernanceComponent {
  private readonly api = inject(ApiService);

  readonly dashboard = signal<GovernanceDashboard | null>(null);
  readonly accessReview = signal<AccessReviewRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.governanceDashboard().subscribe({
      next: (dashboard) => this.dashboard.set(dashboard),
      error: () => this.error.set('Unable to load governance dashboard.'),
      complete: () => this.loading.set(false)
    });
    this.api.accessReview().subscribe({
      next: (records) => this.accessReview.set(records),
      error: () => this.accessReview.set([])
    });
  }

  formatDate(value?: string): string {
    if (!value) return 'No information has been added yet.';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value));
  }
}
