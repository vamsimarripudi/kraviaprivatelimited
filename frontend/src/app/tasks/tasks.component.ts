import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { CompanyTask, CompanyTaskRequest, TaskCategory, TaskPriority, TaskStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const TASK_CATEGORIES: Array<{ value: TaskCategory; label: string }> = [
  { value: 'FOUNDER_TASK', label: 'Founder Task' },
  { value: 'DIRECTOR_TASK', label: 'Director Task' },
  { value: 'CA_TASK', label: 'CA Task' },
  { value: 'LAWYER_TASK', label: 'Lawyer Task' },
  { value: 'BANK_TASK', label: 'Bank Task' },
  { value: 'PRODUCT_TASK', label: 'Product Task' },
  { value: 'FINANCE_TASK', label: 'Finance Task' },
  { value: 'COMPLIANCE_TASK', label: 'Compliance Task' },
  { value: 'DOCUMENT_TASK', label: 'Document Task' },
  { value: 'INVESTOR_TASK', label: 'Investor Task' },
  { value: 'CUSTOMER_TASK', label: 'Customer Task' },
  { value: 'OTHER', label: 'Other' }
];

const TASK_STATUSES: Array<{ value: TaskStatus; label: string }> = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'DONE', label: 'Done' },
  { value: 'ARCHIVED', label: 'Archived' }
];

const TASK_PRIORITIES: Array<{ value: TaskPriority; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' }
];

const ACTIVE_STATUSES = new Set<TaskStatus>(['TODO', 'IN_PROGRESS', 'WAITING', 'BLOCKED']);

@Component({
  selector: 'kravia-tasks',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './tasks.component.html'
})
export class TasksComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly categories = TASK_CATEGORIES;
  readonly statuses = TASK_STATUSES;
  readonly priorities = TASK_PRIORITIES;

  readonly tasks = signal<CompanyTask[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly category = signal<TaskCategory | ''>('');
  readonly assignee = signal('');
  readonly status = signal<TaskStatus | ''>('');
  readonly priority = signal<TaskPriority | ''>('');
  readonly selected = signal<CompanyTask | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.category() || this.assignee().trim() || this.status() || this.priority()));
  readonly summaryCards = computed(() => {
    const tasks = this.tasks();
    return [
      { label: 'Open Tasks', value: tasks.filter((task) => !['DONE', 'ARCHIVED'].includes(task.status)).length, tone: 'neutral' },
      { label: 'Overdue', value: tasks.filter((task) => task.overdue).length, tone: 'critical' },
      { label: 'Blocked', value: tasks.filter((task) => task.status === 'BLOCKED').length, tone: 'warning' },
      { label: 'Done', value: tasks.filter((task) => task.status === 'DONE').length, tone: 'positive' }
    ];
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    category: ['OTHER' as TaskCategory, Validators.required],
    description: ['', Validators.maxLength(3000)],
    assignedTo: ['', Validators.maxLength(255)],
    dueDate: [''],
    priority: ['MEDIUM' as TaskPriority, Validators.required],
    status: ['TODO' as TaskStatus, Validators.required],
    relatedSection: ['', Validators.maxLength(255)],
    relatedDocumentId: [''],
    notes: ['', Validators.maxLength(4000)]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.tasks({ query: this.query(), category: this.category(), assignee: this.assignee(), status: this.status(), priority: this.priority() }).subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        const selectedId = this.selected()?.id;
        this.selected.set(tasks.find((task) => task.id === selectedId) ?? tasks[0] ?? null);
      },
      error: () => this.error.set('Unable to load company tasks.'),
      complete: () => this.loading.set(false)
    });
  }

  applySearch(value: string): void { this.query.set(value); this.load(); }
  applyCategory(value: string): void { this.category.set(value as TaskCategory | ''); this.load(); }
  applyAssignee(value: string): void { this.assignee.set(value); this.load(); }
  applyStatus(value: string): void { this.status.set(value as TaskStatus | ''); this.load(); }
  applyPriority(value: string): void { this.priority.set(value as TaskPriority | ''); this.load(); }

  clearFilters(): void {
    this.query.set('');
    this.category.set('');
    this.assignee.set('');
    this.status.set('');
    this.priority.set('');
    this.load();
  }

  select(task: CompanyTask): void {
    this.selected.set(task);
    if (this.editingId() !== task.id) this.editingId.set(null);
  }

  startEdit(task: CompanyTask): void {
    if (!this.canEditTask(task)) return;
    this.select(task);
    this.editingId.set(task.id);
    this.form.reset({
      title: task.title,
      category: task.category,
      description: task.description ?? '',
      assignedTo: task.assignedTo ?? '',
      dueDate: task.dueDate ?? '',
      priority: task.priority,
      status: task.status,
      relatedSection: task.relatedSection ?? '',
      relatedDocumentId: task.relatedDocumentId ?? '',
      notes: task.notes ?? ''
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

    const validation = this.validationMessage();
    if (validation) {
      this.error.set(validation);
      return;
    }

    const payload = this.payload();
    this.error.set('');
    this.success.set('');
    const editingId = this.editingId();
    const request = editingId ? this.api.updateTask(editingId, payload) : this.api.createTask(payload);
    request.subscribe({
      next: (task) => {
        this.selected.set(task);
        this.editingId.set(null);
        this.resetForm();
        this.success.set(editingId ? 'Task saved.' : 'Task created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Task could not be saved.' : 'Task could not be created.')
    });
  }

  complete(task: CompanyTask): void {
    if (!this.canEditTask(task) || task.status === 'DONE') return;
    this.error.set('');
    this.success.set('');
    this.api.completeTask(task.id).subscribe({
      next: (updated) => {
        this.selected.set(updated);
        this.success.set('Task marked done.');
        this.load();
      },
      error: () => this.error.set('Task could not be marked done.')
    });
  }

  archive(task: CompanyTask): void {
    if (!this.canArchive() || task.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveTask(task.id).subscribe({
      next: () => {
        this.success.set('Task archived.');
        this.load();
      },
      error: () => this.error.set('Task could not be archived.')
    });
  }

  canEditTask(task: CompanyTask): boolean { return this.canEdit() && task.status !== 'ARCHIVED'; }
  requiresAssignee(status: TaskStatus): boolean { return ACTIVE_STATUSES.has(status); }
  requiresDueDate(priority: TaskPriority): boolean { return priority === 'HIGH' || priority === 'CRITICAL'; }
  categoryLabel(value: TaskCategory): string { return this.categories.find((category) => category.value === value)?.label ?? value; }
  statusLabel(value: TaskStatus): string { return this.statuses.find((status) => status.value === value)?.label ?? value; }
  priorityLabel(value: TaskPriority): string { return this.priorities.find((priority) => priority.value === value)?.label ?? value; }

  dueLabel(task: CompanyTask): string {
    if (!task.dueDate) return 'No information has been added yet.';
    if (task.overdue) return 'Overdue by ' + Math.abs(task.daysUntilDue ?? 0) + ' day(s)';
    if (task.daysUntilDue === 0) return 'Due today';
    if ((task.daysUntilDue ?? 99) > 0) return 'Due in ' + task.daysUntilDue + ' day(s)';
    return this.formatDate(task.dueDate);
  }

  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }
  formatDate(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00')) : 'No information has been added yet.'; }
  formatDateTime(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.'; }

  private payload(): CompanyTaskRequest {
    const values = this.form.getRawValue();
    return {
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim() || undefined,
      assignedTo: values.assignedTo.trim() || undefined,
      dueDate: values.dueDate || undefined,
      priority: values.priority,
      status: values.status,
      relatedSection: values.relatedSection.trim() || undefined,
      relatedDocumentId: values.relatedDocumentId.trim() || undefined,
      notes: values.notes.trim() || undefined
    };
  }

  private validationMessage(): string {
    const values = this.form.getRawValue();
    if (this.requiresAssignee(values.status) && !values.assignedTo.trim()) return 'Assigned person is required when task is active.';
    if (this.requiresDueDate(values.priority) && !values.dueDate) return 'Due date is required for high or critical priority tasks.';
    return '';
  }

  private resetForm(): void {
    this.form.reset({
      title: '',
      category: 'OTHER',
      description: '',
      assignedTo: '',
      dueDate: '',
      priority: 'MEDIUM',
      status: 'TODO',
      relatedSection: '',
      relatedDocumentId: '',
      notes: ''
    });
  }
}