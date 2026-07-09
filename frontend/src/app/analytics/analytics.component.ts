import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiService } from '../core/http/api.service';
import { AnalyticsDashboard, AnalyticsExportFormat, AnalyticsMetric, AnalyticsModule, AnalyticsTrendPoint } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

interface AnalyticsModuleOption {
  value: AnalyticsModule;
  label: string;
  description: string;
}

@Component({
  selector: 'kravia-analytics',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './analytics.component.html'
})
export class AnalyticsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly modules: AnalyticsModuleOption[] = [
    { value: 'EXECUTIVE', label: 'Executive Analytics', description: 'Company health across the operating system' },
    { value: 'FINANCE', label: 'Finance Analytics', description: 'Revenue, expense, profit/loss, cash, and GST visibility' },
    { value: 'SALES', label: 'Sales Analytics', description: 'Lead pipeline, customer conversion, and follow-up health' },
    { value: 'PRODUCTS', label: 'Product Analytics', description: 'Product readiness, live status, and risk visibility' },
    { value: 'COMPLIANCE', label: 'Compliance Analytics', description: 'Due dates, overdue work, and compliance risk' },
    { value: 'HR', label: 'HR Analytics', description: 'Headcount, leave, attendance, payroll, and exits' },
    { value: 'LEGAL', label: 'Legal Analytics', description: 'Contracts, signatures, renewals, and legal exposure' },
    { value: 'PROCUREMENT', label: 'Procurement Analytics', description: 'Vendor, bill, subscription, and payment visibility' },
    { value: 'OPERATIONS', label: 'Operational Analytics', description: 'Tasks, assets, licenses, and operating risk' }
  ];

  readonly filterForm = this.fb.nonNullable.group({
    module: this.fb.nonNullable.control<AnalyticsModule>('EXECUTIVE'),
    from: '',
    to: ''
  });

  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly dashboard = signal<AnalyticsDashboard | null>(null);

  constructor() {
    this.load();
  }

  selectedModuleLabel(): string {
    return this.selectedModule()?.label ?? 'Analytics';
  }

  selectedModuleDescription(): string {
    return this.selectedModule()?.description ?? '';
  }

  load(): void {
    this.error.set('');
    this.success.set('');
    this.loading.set(true);
    const filters = this.filterForm.getRawValue();
    this.api.analyticsDashboard(filters.module, { from: filters.from, to: filters.to })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (dashboard) => this.dashboard.set(dashboard),
        error: () => this.error.set('Unable to load analytics records.')
      });
  }

  requestExport(format: AnalyticsExportFormat): void {
    const filters = this.filterForm.getRawValue();
    this.exporting.set(true);
    this.error.set('');
    this.success.set('');
    this.api.requestAnalyticsExport({ module: filters.module, format, from: filters.from || undefined, to: filters.to || undefined })
      .pipe(finalize(() => this.exporting.set(false)))
      .subscribe({
        next: (response) => this.success.set(response.message),
        error: () => this.error.set('Unable to log analytics export request.')
      });
  }

  print(): void {
    window.print();
  }

  metricValue(metric: AnalyticsMetric): string {
    if (metric.unit === 'INR') {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(metric.value ?? 0);
    }
    if (metric.unit === 'percent') {
      return `${this.number(metric.value)}%`;
    }
    return this.number(metric.value);
  }

  trendValue(point: AnalyticsTrendPoint): string {
    return this.number(point.value);
  }

  number(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value ?? 0);
  }

  label(value: string): string {
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private selectedModule(): AnalyticsModuleOption | undefined {
    return this.modules.find((module) => module.value === this.filterForm.controls.module.value);
  }
}
