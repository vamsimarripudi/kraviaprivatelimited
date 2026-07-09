import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { DataClassification, DataPrivacyRecord } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

@Component({
  selector: 'kravia-privacy-center',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './privacy-center.component.html'
})
export class PrivacyCenterComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly records = signal<DataPrivacyRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly classifications: DataClassification[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

  readonly form = this.fb.nonNullable.group({
    moduleName: ['', Validators.required],
    recordId: [''],
    classification: ['INTERNAL' as DataClassification, Validators.required],
    sensitiveDocument: [false],
    accessVisibility: [''],
    retentionRule: ['']
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.privacyRecords({}).subscribe({
      next: (records) => this.records.set(records),
      error: () => this.error.set('Unable to load privacy records.'),
      complete: () => this.loading.set(false)
    });
  }

  create(): void {
    if (this.form.invalid) return;
    this.error.set('');
    this.success.set('');
    const value = this.form.getRawValue();
    this.api.createPrivacyRecord({ ...value, recordId: value.recordId || undefined }).subscribe({
      next: () => {
        this.success.set('Privacy record saved.');
        this.form.reset({ moduleName: '', recordId: '', classification: 'INTERNAL', sensitiveDocument: false, accessVisibility: '', retentionRule: '' });
        this.load();
      },
      error: () => this.error.set('Privacy record could not be saved.')
    });
  }

  requestExport(id: string): void {
    this.api.requestPrivacyExport(id).subscribe({ next: () => this.load(), error: () => this.error.set('Export request could not be recorded.') });
  }

  requestDeletion(id: string): void {
    this.api.requestPrivacyDeletion(id).subscribe({ next: () => this.load(), error: () => this.error.set('Deletion request could not be recorded.') });
  }
}
