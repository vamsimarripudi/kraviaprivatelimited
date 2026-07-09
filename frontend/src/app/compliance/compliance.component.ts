import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { ComplianceCategory, ComplianceItem, ComplianceItemRequest, CompliancePriority, ComplianceStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const COMPLIANCE_CATEGORIES: Array<{ value: ComplianceCategory; label: string }> = [
  { value: 'MCA', label: 'MCA' },
  { value: 'ROC', label: 'ROC' },
  { value: 'INC_22', label: 'INC-22' },
  { value: 'AUDITOR_APPOINTMENT', label: 'Auditor Appointment' },
  { value: 'GST_REGISTRATION', label: 'GST Registration' },
  { value: 'GST_FILING', label: 'GST Filing' },
  { value: 'STARTUP_INDIA', label: 'Startup India' },
  { value: 'TRADEMARK', label: 'Trademark' },
  { value: 'MSME_UDYAM', label: 'MSME / Udyam' },
  { value: 'EPFO', label: 'EPFO' },
  { value: 'ESIC', label: 'ESIC' },
  { value: 'BANK_KYC', label: 'Bank KYC' },
  { value: 'ANNUAL_COMPLIANCE', label: 'Annual Compliance' },
  { value: 'BOARD_RESOLUTION', label: 'Board Resolution' },
  { value: 'LEGAL_AGREEMENT', label: 'Legal Agreement' },
  { value: 'OTHER', label: 'Other' }
];

const COMPLIANCE_STATUSES: Array<{ value: ComplianceStatus; label: string }> = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING_FOR_CA', label: 'Waiting for CA' },
  { value: 'WAITING_FOR_DIRECTOR', label: 'Waiting for Director' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NOT_APPLICABLE', label: 'Not Applicable' },
  { value: 'ARCHIVED', label: 'Archived' }
];

const COMPLIANCE_PRIORITIES: Array<{ value: CompliancePriority; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' }
];

const ACTIVE_STATUSES = new Set<ComplianceStatus>([
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_FOR_CA',
  'WAITING_FOR_DIRECTOR',
  'SUBMITTED',
  'REJECTED'
]);

@Component({
  selector: 'kravia-compliance',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './compliance.component.html'
})
export class ComplianceComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly categories = COMPLIANCE_CATEGORIES;
  readonly statuses = COMPLIANCE_STATUSES;
  readonly priorities = COMPLIANCE_PRIORITIES;

  readonly items = signal<ComplianceItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly category = signal<ComplianceCategory | ''>('');
  readonly status = signal<ComplianceStatus | ''>('');
  readonly priority = signal<CompliancePriority | ''>('');
  readonly selected = signal<ComplianceItem | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.category() || this.status() || this.priority()));
  readonly summaryCards = computed(() => {
    const items = this.items();
    return [
      { label: 'Open Items', value: items.filter((item) => !['COMPLETED', 'APPROVED', 'NOT_APPLICABLE', 'ARCHIVED'].includes(item.status)).length, tone: 'neutral' },
      { label: 'Overdue', value: items.filter((item) => item.overdue).length, tone: 'critical' },
      { label: 'Due Soon', value: items.filter((item) => item.upcomingDue).length, tone: 'warning' },
      { label: 'Critical Priority', value: items.filter((item) => item.priority === 'CRITICAL').length, tone: 'critical' }
    ];
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    category: ['OTHER' as ComplianceCategory, Validators.required],
    description: ['', Validators.maxLength(3000)],
    dueDate: [''],
    status: ['NOT_STARTED' as ComplianceStatus, Validators.required],
    priority: ['MEDIUM' as CompliancePriority, Validators.required],
    responsiblePerson: ['', Validators.maxLength(255)],
    relatedDocumentId: [''],
    notes: ['', Validators.maxLength(4000)]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.complianceItems({ query: this.query(), category: this.category(), status: this.status(), priority: this.priority() }).subscribe({
      next: (items) => {
        this.items.set(items);
        const selectedId = this.selected()?.id;
        this.selected.set(items.find((item) => item.id === selectedId) ?? items[0] ?? null);
      },
      error: () => this.error.set('Unable to load compliance items.'),
      complete: () => this.loading.set(false)
    });
  }

  applySearch(value: string): void { this.query.set(value); this.load(); }
  applyCategory(value: string): void { this.category.set(value as ComplianceCategory | ''); this.load(); }
  applyStatus(value: string): void { this.status.set(value as ComplianceStatus | ''); this.load(); }
  applyPriority(value: string): void { this.priority.set(value as CompliancePriority | ''); this.load(); }

  clearFilters(): void {
    this.query.set('');
    this.category.set('');
    this.status.set('');
    this.priority.set('');
    this.load();
  }

  select(item: ComplianceItem): void {
    this.selected.set(item);
    if (this.editingId() !== item.id) this.editingId.set(null);
  }

  startEdit(item: ComplianceItem): void {
    if (!this.canEditItem(item)) return;
    this.select(item);
    this.editingId.set(item.id);
    this.form.reset({
      title: item.title,
      category: item.category,
      description: item.description ?? '',
      dueDate: item.dueDate ?? '',
      status: item.status,
      priority: item.priority,
      responsiblePerson: item.responsiblePerson ?? '',
      relatedDocumentId: item.relatedDocumentId ?? '',
      notes: item.notes ?? ''
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

    const validationMessage = this.complianceValidationMessage();
    if (validationMessage) {
      this.error.set(validationMessage);
      return;
    }

    const payload = this.payload();
    this.error.set('');
    this.success.set('');
    const editingId = this.editingId();
    const request = editingId ? this.api.updateComplianceItem(editingId, payload) : this.api.createComplianceItem(payload);
    request.subscribe({
      next: (item) => {
        this.selected.set(item);
        this.editingId.set(null);
        this.resetForm();
        this.success.set(editingId ? 'Compliance item saved.' : 'Compliance item created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Compliance item could not be saved.' : 'Compliance item could not be created.')
    });
  }

  archive(item: ComplianceItem): void {
    if (!this.canArchive() || item.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveComplianceItem(item.id).subscribe({
      next: () => {
        this.success.set('Compliance item archived.');
        this.load();
      },
      error: () => this.error.set('Compliance item could not be archived.')
    });
  }

  canEditItem(item: ComplianceItem): boolean { return this.canEdit() && item.status !== 'ARCHIVED'; }
  requiresResponsiblePerson(status: ComplianceStatus): boolean { return ACTIVE_STATUSES.has(status); }

  categoryLabel(value: ComplianceCategory): string { return this.categories.find((category) => category.value === value)?.label ?? value; }
  statusLabel(value: ComplianceStatus): string { return this.statuses.find((status) => status.value === value)?.label ?? value; }
  priorityLabel(value: CompliancePriority): string { return this.priorities.find((priority) => priority.value === value)?.label ?? value; }

  dueLabel(item: ComplianceItem): string {
    if (!item.dueDate) return 'No information has been added yet.';
    if (item.overdue) return 'Overdue by ' + Math.abs(item.daysUntilDue ?? 0) + ' day(s)';
    if (item.upcomingDue && item.daysUntilDue === 0) return 'Due today';
    if (item.upcomingDue) return 'Due in ' + item.daysUntilDue + ' day(s)';
    return this.formatDate(item.dueDate);
  }

  dueClass(item: ComplianceItem): string {
    if (item.overdue) return 'overdue';
    if (item.upcomingDue) return 'upcoming';
    return 'neutral';
  }

  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }

  formatDate(value?: string): string {
    if (!value) return 'No information has been added yet.';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00'));
  }

  formatDateTime(value?: string): string {
    if (!value) return 'No information has been added yet.';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  private payload(): ComplianceItemRequest {
    const values = this.form.getRawValue();
    return {
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim() || undefined,
      dueDate: values.dueDate || undefined,
      status: values.status,
      priority: values.priority,
      responsiblePerson: values.responsiblePerson.trim() || undefined,
      relatedDocumentId: values.relatedDocumentId.trim() || undefined,
      notes: values.notes.trim() || undefined
    };
  }

  private complianceValidationMessage(): string {
    const values = this.form.getRawValue();
    if (values.status !== 'NOT_APPLICABLE' && !values.dueDate) return 'Due date is required unless compliance item is not applicable.';
    if (this.requiresResponsiblePerson(values.status) && !values.responsiblePerson.trim()) return 'Responsible person is required for active compliance items.';
    return '';
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      category: 'OTHER',
      description: '',
      dueDate: '',
      status: 'NOT_STARTED',
      priority: 'MEDIUM',
      responsiblePerson: '',
      relatedDocumentId: '',
      notes: ''
    });
  }
}