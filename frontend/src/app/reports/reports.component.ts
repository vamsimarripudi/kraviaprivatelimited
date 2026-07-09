import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { ReportResponse, ReportType } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  { value: 'company-summary', label: 'Company Summary Report', description: 'Workspace-wide executive coverage.' },
  { value: 'financial-summary', label: 'Financial Summary Report', description: 'Monthly financial totals.' },
  { value: 'profit-loss', label: 'Profit & Loss Report', description: 'Revenue, expenses, and profit/loss.' },
  { value: 'board-meetings', label: 'Board Meeting Report', description: 'Meetings, decisions, and actions.' },
  { value: 'compliance', label: 'Compliance Report', description: 'Compliance items and due dates.' },
  { value: 'tasks', label: 'Task Report', description: 'Operational task register.' },
  { value: 'products', label: 'Product Status Report', description: 'Product progress and readiness.' },
  { value: 'documents', label: 'Document Report', description: 'Document vault inventory.' },
  { value: 'contacts', label: 'Contact Report', description: 'Contacts and partners.' },
  { value: 'activity', label: 'Activity Report', description: 'Audit activity for permitted users.' }
];

const MODULES = [
  { value: '', label: 'All modules' },
  { value: 'COMPANY_PROFILE', label: 'Company Profile' },
  { value: 'DOCUMENTS', label: 'Documents' },
  { value: 'BOARD_MEETINGS', label: 'Board Meetings' },
  { value: 'FINANCE', label: 'Finance' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'PRODUCTS', label: 'Products' },
  { value: 'CONTACTS', label: 'Contacts' },
  { value: 'ANNOUNCEMENTS', label: 'Announcements' },
  { value: 'AUDIT_LOGS', label: 'Audit Logs' }
];

@Component({
  selector: 'kravia-reports',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './reports.component.html'
})
export class ReportsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly reportTypes = REPORT_TYPES;
  readonly modules = MODULES;
  readonly report = signal<ReportResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly generated = signal(false);
  readonly totalRows = computed(() => this.report()?.sections.reduce((total, section) => total + section.rows.length, 0) ?? 0);

  readonly form = this.fb.nonNullable.group({
    reportType: ['company-summary' as ReportType, Validators.required],
    from: [''],
    to: [''],
    module: ['']
  });

  constructor() { this.generate(); }

  generate(): void {
    if (this.form.invalid) return;
    const values = this.form.getRawValue();
    if (values.from && values.to && values.from > values.to) {
      this.error.set('Start date cannot be after end date.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    this.generated.set(true);
    this.api.report(values.reportType, { from: values.from || undefined, to: values.to || undefined, module: values.module || undefined }).subscribe({
      next: (report) => this.report.set(report),
      error: () => this.error.set('Unable to generate report.'),
      complete: () => this.loading.set(false)
    });
  }

  clearFilters(): void {
    const reportType = this.form.controls.reportType.value;
    this.form.reset({ reportType, from: '', to: '', module: '' });
    this.generate();
  }

  print(): void { window.print(); }

  exportPlaceholder(type: 'PDF' | 'Excel'): void {
    this.success.set(`${type} export is prepared as a placeholder for future backend generation.`);
  }

  reportDescription(type: ReportType): string {
    return this.reportTypes.find((item) => item.value === type)?.description ?? '';
  }

  cell(row: Record<string, string>, column: string): string {
    return row[column] || 'No information has been added yet.';
  }

  formatDateTime(value?: string): string {
    return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.';
  }
}

