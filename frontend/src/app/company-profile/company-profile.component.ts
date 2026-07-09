import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { CompanyProfile, CompanyTask, ProductRecord } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

type ProfileFormKey = Exclude<keyof CompanyProfile, 'id'>;

@Component({
  selector: 'kravia-company-profile',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './company-profile.component.html'
})
export class CompanyProfileComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly profile = signal<CompanyProfile | null>(null);
  readonly editing = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly taskSummary = signal<CompanyTask[]>([]);
  readonly productSummary = signal<ProductRecord[]>([]);
  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly taskSummaryCards = computed(() => {
    const tasks = this.taskSummary();
    const now = new Date();
    return [
      { label: 'Open tasks', value: tasks.filter((task) => !['DONE', 'ARCHIVED'].includes(task.status)).length, tone: 'neutral' },
      { label: 'Overdue tasks', value: tasks.filter((task) => task.overdue).length, tone: 'critical' },
      { label: 'Blocked tasks', value: tasks.filter((task) => task.status === 'BLOCKED').length, tone: 'warning' },
      { label: 'Completed this month', value: tasks.filter((task) => task.completedAt && this.sameMonth(new Date(task.completedAt), now)).length, tone: 'positive' }
    ];
  });

  readonly productSummaryCards = computed(() => {
    const products = this.productSummary();
    return [
      { label: 'Active products', value: products.filter((product) => !['PAUSED', 'ARCHIVED'].includes(product.status)).length, tone: 'neutral' },
      { label: 'Launch-ready products', value: products.filter((product) => product.status === 'LAUNCH_READY').length, tone: 'positive' },
      { label: 'Paused products', value: products.filter((product) => product.status === 'PAUSED').length, tone: 'warning' },
      { label: 'Products with risks', value: products.filter((product) => Boolean(product.risks?.trim())).length, tone: 'critical' }
    ];
  });
  readonly fields: Array<{ key: ProfileFormKey; label: string; type?: string; multiline?: boolean }> = [
    { key: 'companyName', label: 'Company name' },
    { key: 'cin', label: 'CIN' },
    { key: 'pan', label: 'PAN' },
    { key: 'tan', label: 'TAN' },
    { key: 'registeredOfficeAddress', label: 'Registered office address', multiline: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone' },
    { key: 'dateOfIncorporation', label: 'Date of incorporation', type: 'date' },
    { key: 'authorizedCapital', label: 'Authorized capital' },
    { key: 'paidUpCapital', label: 'Paid-up capital' },
    { key: 'directors', label: 'Directors', multiline: true },
    { key: 'shareholders', label: 'Shareholders', multiline: true },
    { key: 'companyStatus', label: 'Company status' },
    { key: 'lastUpdatedDate', label: 'Last updated date', type: 'date' }
  ];

  readonly form = this.fb.nonNullable.group({
    companyName: ['', Validators.required],
    cin: [''],
    pan: [''],
    tan: [''],
    registeredOfficeAddress: [''],
    email: ['', Validators.email],
    phone: [''],
    dateOfIncorporation: [''],
    authorizedCapital: [''],
    paidUpCapital: [''],
    directors: [''],
    shareholders: [''],
    companyStatus: [''],
    lastUpdatedDate: ['']
  });

  constructor() {
    this.load();
    this.loadTaskSummary();
    this.loadProductSummary();
  }

  load(): void {
    this.loading.set(true);
    this.api.getCompanyProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.form.patchValue(this.normalize(profile));
      },
      error: () => this.error.set('Unable to load company profile.'),
      complete: () => this.loading.set(false)
    });
  }

  startEdit(): void {
    this.success.set('');
    this.editing.set(true);
    this.form.patchValue(this.normalize(this.profile() ?? {}));
  }

  cancel(): void {
    this.editing.set(false);
    this.form.patchValue(this.normalize(this.profile() ?? {}));
  }

  save(): void {
    if (this.form.invalid || !this.canEdit()) return;
    this.error.set('');
    this.success.set('');
    this.api.saveCompanyProfile(this.form.getRawValue()).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.form.patchValue(this.normalize(profile));
        this.editing.set(false);
        this.success.set('Company profile saved.');
      },
      error: () => this.error.set('Company profile could not be saved.')
    });
  }

  displayValue(key: ProfileFormKey): string {
    const value = this.profile()?.[key];
    return value ? String(value) : 'No information has been added yet.';
  }

  loadTaskSummary(): void {
    this.api.tasks({}).subscribe({
      next: (tasks) => this.taskSummary.set(tasks),
      error: () => this.taskSummary.set([])
    });
  }

  loadProductSummary(): void {
    this.api.products({}).subscribe({
      next: (products) => this.productSummary.set(products),
      error: () => this.productSummary.set([])
    });
  }
  private sameMonth(value: Date, now: Date): boolean {
    return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
  }
  private normalize(profile: CompanyProfile): Record<ProfileFormKey, string> {
    return {
      companyName: profile.companyName ?? '',
      cin: profile.cin ?? '',
      pan: profile.pan ?? '',
      tan: profile.tan ?? '',
      registeredOfficeAddress: profile.registeredOfficeAddress ?? '',
      email: profile.email ?? '',
      phone: profile.phone ?? '',
      dateOfIncorporation: profile.dateOfIncorporation ?? '',
      authorizedCapital: profile.authorizedCapital ?? '',
      paidUpCapital: profile.paidUpCapital ?? '',
      directors: profile.directors ?? '',
      shareholders: profile.shareholders ?? '',
      companyStatus: profile.companyStatus ?? '',
      lastUpdatedDate: profile.lastUpdatedDate ?? ''
    };
  }
}

