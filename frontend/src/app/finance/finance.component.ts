import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { FinancialRecord, FinancialRecordRequest, FinancialRecordStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const FINANCIAL_STATUSES: Array<{ value: FinancialRecordStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'FINAL', label: 'Final' },
  { value: 'ARCHIVED', label: 'Archived' }
];

@Component({
  selector: 'kravia-finance',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './finance.component.html'
})
export class FinanceComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly statuses = FINANCIAL_STATUSES;
  readonly records = signal<FinancialRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly reportingYear = signal('');
  readonly reportingMonth = signal('');
  readonly selected = signal<FinancialRecord | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.reportingYear() || this.reportingMonth()));
  readonly latest = computed(() => this.selected() ?? this.records()[0] ?? null);

  readonly form = this.fb.nonNullable.group({
    reportingMonth: ['', Validators.required],
    revenue: [0, [Validators.required, Validators.min(0)]],
    expenses: [0, [Validators.required, Validators.min(0)]],
    cashBalance: [0, [Validators.min(0)]],
    receivables: [0, [Validators.min(0)]],
    payables: [0, [Validators.min(0)]],
    gstCollected: [0, [Validators.required, Validators.min(0)]],
    gstPaid: [0, [Validators.required, Validators.min(0)]],
    cloudSubscriptions: [0, [Validators.min(0)]],
    vendorPayments: [0, [Validators.min(0)]],
    directorRemuneration: [0, [Validators.min(0)]],
    founderNotes: [''],
    status: ['DRAFT' as FinancialRecordStatus, Validators.required]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.financialRecords({ query: this.query(), reportingYear: this.reportingYear(), reportingMonth: this.reportingMonth() }).subscribe({
      next: (records) => {
        this.records.set(records);
        const selectedId = this.selected()?.id;
        this.selected.set(records.find((record) => record.id === selectedId) ?? records[0] ?? null);
      },
      error: () => this.error.set('Unable to load financial records.'),
      complete: () => this.loading.set(false)
    });
  }

  applySearch(value: string): void { this.query.set(value); this.load(); }
  applyYear(value: string): void { this.reportingYear.set(value); this.load(); }
  applyMonth(value: string): void { this.reportingMonth.set(value); this.load(); }

  clearFilters(): void {
    this.query.set('');
    this.reportingYear.set('');
    this.reportingMonth.set('');
    this.load();
  }

  select(record: FinancialRecord): void {
    this.selected.set(record);
    if (this.editingId() !== record.id) this.editingId.set(null);
  }

  startEdit(record: FinancialRecord): void {
    if (!this.canEditRecord(record)) return;
    this.select(record);
    this.editingId.set(record.id);
    this.form.reset({
      reportingMonth: record.reportingMonth,
      revenue: record.revenue,
      expenses: record.expenses,
      cashBalance: record.cashBalance,
      receivables: record.receivables,
      payables: record.payables,
      gstCollected: record.gstCollected,
      gstPaid: record.gstPaid,
      cloudSubscriptions: record.cloudSubscriptions,
      vendorPayments: record.vendorPayments,
      directorRemuneration: record.directorRemuneration,
      founderNotes: record.founderNotes ?? '',
      status: record.status
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  submit(): void {
    if (!this.canEdit()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.payload();
    this.error.set('');
    this.success.set('');
    const editingId = this.editingId();
    const request = editingId ? this.api.updateFinancialRecord(editingId, payload) : this.api.createFinancialRecord(payload);
    request.subscribe({
      next: (record) => {
        this.selected.set(record);
        this.editingId.set(null);
        this.resetForm();
        this.success.set(editingId ? 'Financial record saved.' : 'Financial record created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Financial record could not be saved.' : 'Financial record could not be created.')
    });
  }

  archive(record: FinancialRecord): void {
    if (!this.canArchive() || record.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveFinancialRecord(record.id).subscribe({
      next: () => {
        this.success.set('Financial record archived.');
        this.load();
      },
      error: () => this.error.set('Financial record could not be archived.')
    });
  }

  canEditRecord(record: FinancialRecord): boolean { return this.canEdit() && record.status !== 'ARCHIVED'; }

  calculatedProfit(): number {
    const values = this.form.getRawValue();
    return this.toNumber(values.revenue) - this.toNumber(values.expenses);
  }

  calculatedGst(): number {
    const values = this.form.getRawValue();
    return this.toNumber(values.gstCollected) - this.toNumber(values.gstPaid);
  }

  summaryCards(record: FinancialRecord | null): Array<{ label: string; value: number; tone?: string }> {
    if (!record) return [];
    return [
      { label: 'Revenue', value: record.revenue },
      { label: 'Expenses', value: record.expenses },
      { label: 'Profit / Loss', value: record.profitOrLoss, tone: this.tone(record.profitOrLoss) },
      { label: 'Cash Balance', value: record.cashBalance },
      { label: 'Receivables', value: record.receivables },
      { label: 'Payables', value: record.payables },
      { label: 'Net GST Position', value: record.netGstPosition, tone: this.tone(record.netGstPosition) }
    ];
  }

  statusLabel(value: FinancialRecordStatus): string {
    return this.statuses.find((status) => status.value === value)?.label ?? value;
  }

  currency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0));
  }

  tone(value: number): string {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  }

  monthLabel(value: string): string {
    if (!value) return 'No information has been added yet.';
    const [year, month] = value.split('-');
    return `${month}/${year}`;
  }

  private payload(): FinancialRecordRequest {
    const values = this.form.getRawValue();
    return {
      reportingMonth: values.reportingMonth,
      revenue: this.toNumber(values.revenue),
      expenses: this.toNumber(values.expenses),
      cashBalance: this.toNumber(values.cashBalance),
      receivables: this.toNumber(values.receivables),
      payables: this.toNumber(values.payables),
      gstCollected: this.toNumber(values.gstCollected),
      gstPaid: this.toNumber(values.gstPaid),
      cloudSubscriptions: this.toNumber(values.cloudSubscriptions),
      vendorPayments: this.toNumber(values.vendorPayments),
      directorRemuneration: this.toNumber(values.directorRemuneration),
      founderNotes: values.founderNotes.trim() || undefined,
      status: values.status
    };
  }

  private resetForm(): void {
    this.form.reset({
      reportingMonth: '',
      revenue: 0,
      expenses: 0,
      cashBalance: 0,
      receivables: 0,
      payables: 0,
      gstCollected: 0,
      gstPaid: 0,
      cloudSubscriptions: 0,
      vendorPayments: 0,
      directorRemuneration: 0,
      founderNotes: '',
      status: 'DRAFT'
    });
  }

  private toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
