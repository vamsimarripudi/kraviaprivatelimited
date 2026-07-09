import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { RiskCategory, RiskLevel, RiskRecord, RiskStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

@Component({
  selector: 'kravia-risk-register',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './risk-register.component.html'
})
export class RiskRegisterComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly risks = signal<RiskRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly categories: RiskCategory[] = ['LEGAL', 'FINANCIAL', 'COMPLIANCE', 'SECURITY', 'PRODUCT', 'OPERATIONAL', 'REPUTATION', 'OTHER'];
  readonly levels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  readonly statuses: RiskStatus[] = ['OPEN', 'MITIGATING', 'MONITORING', 'CLOSED', 'ARCHIVED'];

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    category: ['OPERATIONAL' as RiskCategory, Validators.required],
    description: [''],
    severity: ['MEDIUM' as RiskLevel, Validators.required],
    likelihood: ['MEDIUM' as RiskLevel, Validators.required],
    owner: [''],
    mitigationPlan: [''],
    status: ['OPEN' as RiskStatus, Validators.required],
    reviewDate: [''],
    relatedRecords: ['']
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.risks({}).subscribe({
      next: (risks) => this.risks.set(risks),
      error: () => this.error.set('Unable to load risk register.'),
      complete: () => this.loading.set(false)
    });
  }

  create(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.api.createRisk({ ...value, reviewDate: value.reviewDate || undefined }).subscribe({
      next: () => {
        this.success.set('Risk saved.');
        this.form.reset({ title: '', category: 'OPERATIONAL', description: '', severity: 'MEDIUM', likelihood: 'MEDIUM', owner: '', mitigationPlan: '', status: 'OPEN', reviewDate: '', relatedRecords: '' });
        this.load();
      },
      error: () => this.error.set('Risk could not be saved.')
    });
  }
}
