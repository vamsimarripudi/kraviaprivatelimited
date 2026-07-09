import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/http/api.service';
import { DashboardSummary } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';

interface SummaryCard { label: string; value: number; path: string; note: string; }

@Component({
  selector: 'kravia-dashboard',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  private readonly api = inject(ApiService);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly cards = computed<SummaryCard[]>(() => {
    const data = this.summary();
    if (!data) return [];
    return [
      { label: 'Documents', value: data.documents, path: '/documents', note: 'Stored company files' },
      { label: 'Board meetings', value: data.boardMeetings, path: '/board-meetings', note: 'Recorded decisions' },
      { label: 'Financial records', value: data.financialRecords, path: '/finance', note: 'Monthly summaries' },
      { label: 'Compliance items', value: data.complianceItems, path: '/compliance', note: 'Regulatory work' },
      { label: 'Tasks', value: data.tasks, path: '/tasks', note: 'Operational follow-ups' },
      { label: 'Products', value: data.products, path: '/products', note: 'Portfolio records' },
      { label: 'Contacts', value: data.contacts, path: '/contacts', note: 'Partners and advisors' },
      { label: 'Audit logs', value: data.auditLogs, path: '/audit', note: 'Tracked actions' }
    ];
  });

  constructor() {
    this.api.dashboard().subscribe({
      next: (summary) => this.summary.set(summary),
      error: () => this.error.set('Unable to load company workspace summary.'),
      complete: () => this.loading.set(false)
    });
  }
}
