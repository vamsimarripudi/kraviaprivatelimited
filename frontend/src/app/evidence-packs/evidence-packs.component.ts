import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { EvidencePackRecord, EvidencePackType, EvidenceTimelineItem } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

@Component({
  selector: 'kravia-evidence-packs',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './evidence-packs.component.html'
})
export class EvidencePacksComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly packs = signal<EvidencePackRecord[]>([]);
  readonly timeline = signal<EvidenceTimelineItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly packTypes: EvidencePackType[] = ['BOARD_MEETINGS', 'COMPLIANCE_FILINGS', 'FINANCIAL_RECORDS', 'DOCUMENT_VAULT', 'USER_ACCESS', 'AUDIT_LOGS'];

  readonly form = this.fb.nonNullable.group({
    packType: ['AUDIT_LOGS' as EvidencePackType, Validators.required],
    title: ['']
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.evidencePacks().subscribe({
      next: (packs) => this.packs.set(packs),
      error: () => this.error.set('Unable to load evidence packs.'),
      complete: () => this.loading.set(false)
    });
    this.api.evidenceTimeline().subscribe({ next: (items) => this.timeline.set(items), error: () => this.timeline.set([]) });
  }

  generate(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.api.generateEvidencePack({ packType: value.packType, title: value.title || undefined }).subscribe({
      next: () => {
        this.success.set('Evidence pack generated.');
        this.form.reset({ packType: 'AUDIT_LOGS', title: '' });
        this.load();
      },
      error: () => this.error.set('Evidence pack could not be generated.')
    });
  }

  formatDate(value?: string): string {
    if (!value) return 'No information has been added yet.';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
}
