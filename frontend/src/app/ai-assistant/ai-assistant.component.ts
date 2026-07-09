import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AiModuleContext, AiOutputType, AiQueryRecord, AiQueryRequest } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const MODULE_CONTEXTS: Array<{ value: AiModuleContext; label: string }> = [
  { value: 'ALL', label: 'All permitted records' },
  { value: 'COMPANY_PROFILE', label: 'Company Profile' },
  { value: 'DOCUMENTS', label: 'Documents metadata' },
  { value: 'BOARD_MEETINGS', label: 'Board Meetings' },
  { value: 'FINANCE', label: 'Financial Records' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'TASKS', label: 'Tasks' },
  { value: 'PRODUCTS', label: 'Products' },
  { value: 'CONTACTS', label: 'Contacts' },
  { value: 'ANNOUNCEMENTS', label: 'Announcements' }
];

const OUTPUT_TYPES: Array<{ value: AiOutputType; label: string }> = [
  { value: 'SUMMARY', label: 'Summary' },
  { value: 'EMAIL_DRAFT', label: 'Email Draft' },
  { value: 'BOARD_RESOLUTION', label: 'Board Resolution' },
  { value: 'RISK_ANALYSIS', label: 'Risk Analysis' },
  { value: 'ACTION_ITEMS', label: 'Action Items' },
  { value: 'GENERAL_ANSWER', label: 'General Answer' }
];

@Component({
  selector: 'kravia-ai-assistant',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './ai-assistant.component.html'
})
export class AiAssistantComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly moduleContexts = MODULE_CONTEXTS;
  readonly outputTypes = OUTPUT_TYPES;
  readonly history = signal<AiQueryRecord[]>([]);
  readonly selected = signal<AiQueryRecord | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly hasHistory = computed(() => this.history().length > 0);

  readonly form = this.fb.nonNullable.group({
    query: ['', [Validators.required, Validators.maxLength(2000)]],
    module_context: ['ALL' as AiModuleContext, Validators.required],
    from: [''],
    to: [''],
    output_type: ['GENERAL_ANSWER' as AiOutputType, Validators.required]
  });

  constructor() { this.loadHistory(); }

  loadHistory(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.aiHistory().subscribe({
      next: (records) => {
        this.history.set(records);
        const selectedId = this.selected()?.id;
        this.selected.set(records.find((record) => record.id === selectedId) ?? records[0] ?? null);
      },
      error: () => this.error.set('Unable to load AI query history.'),
      complete: () => this.loading.set(false)
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const values = this.form.getRawValue();
    if (values.from && values.to && values.from > values.to) {
      this.error.set('Start date cannot be after end date.');
      return;
    }
    this.submitting.set(true);
    this.error.set('');
    this.success.set('');
    this.api.aiQuery(this.payload()).subscribe({
      next: (record) => {
        this.selected.set(record);
        this.success.set('AI response created.');
        this.loadHistory();
      },
      error: () => this.error.set('AI query could not be completed.'),
      complete: () => this.submitting.set(false)
    });
  }

  select(record: AiQueryRecord): void {
    this.error.set('');
    this.api.aiHistoryItem(record.id).subscribe({
      next: (detail) => this.selected.set(detail),
      error: () => this.error.set('AI query history item could not be loaded.')
    });
  }

  archive(record: AiQueryRecord): void {
    this.error.set('');
    this.success.set('');
    this.api.archiveAiHistory(record.id).subscribe({
      next: () => {
        this.success.set('AI query archived.');
        this.loadHistory();
      },
      error: () => this.error.set('AI query could not be archived.')
    });
  }

  copyResponse(record: AiQueryRecord): void {
    navigator.clipboard.writeText(record.response).then(
      () => this.success.set('Response copied.'),
      () => this.error.set('Response could not be copied.')
    );
  }

  resetForm(): void {
    this.form.reset({ query: '', module_context: 'ALL', from: '', to: '', output_type: 'GENERAL_ANSWER' });
  }

  moduleLabel(value: AiModuleContext): string { return this.moduleContexts.find((item) => item.value === value)?.label ?? value; }
  outputLabel(value: AiOutputType): string { return this.outputTypes.find((item) => item.value === value)?.label ?? value; }
  formatDateTime(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.'; }
  formatDate(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00')) : 'No information has been added yet.'; }

  private payload(): AiQueryRequest {
    const values = this.form.getRawValue();
    return {
      query: values.query.trim(),
      module_context: values.module_context,
      date_range: values.from || values.to ? { from: values.from || undefined, to: values.to || undefined } : undefined,
      output_type: values.output_type
    };
  }
}
