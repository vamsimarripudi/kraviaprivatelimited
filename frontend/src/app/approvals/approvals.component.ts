import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { ApprovalRecord, ApprovalStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

@Component({
  selector: 'kravia-approvals',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './approvals.component.html'
})
export class ApprovalsComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly approvals = signal<ApprovalRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly statuses: ApprovalStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'];

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    status: ['PENDING_APPROVAL' as ApprovalStatus, Validators.required],
    approver: [''],
    approvalNotes: [''],
    rejectionReason: [''],
    linkedModule: [''],
    linkedRecordId: ['']
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.approvals({}).subscribe({
      next: (approvals) => this.approvals.set(approvals),
      error: () => this.error.set('Unable to load approvals.'),
      complete: () => this.loading.set(false)
    });
  }

  create(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.api.createApproval({ ...value, linkedRecordId: value.linkedRecordId || undefined }).subscribe({
      next: () => {
        this.success.set('Approval request saved.');
        this.form.reset({ title: '', description: '', status: 'PENDING_APPROVAL', approver: '', approvalNotes: '', rejectionReason: '', linkedModule: '', linkedRecordId: '' });
        this.load();
      },
      error: () => this.error.set('Approval request could not be saved.')
    });
  }

  approve(record: ApprovalRecord): void {
    this.api.decideApproval(record.id, { status: 'APPROVED', approvalNotes: 'Approved through governance review.' }).subscribe({ next: () => this.load(), error: () => this.error.set('Approval decision could not be recorded.') });
  }
}
