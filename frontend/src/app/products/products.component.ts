import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { ProductCategory, ProductRecord, ProductRequest, ProductStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const PRODUCT_CATEGORIES: Array<{ value: ProductCategory; label: string }> = [
  { value: 'VIDYALUMA', label: 'VidyaLuma' },
  { value: 'VAANMEET', label: 'VaanMeet' },
  { value: 'VFORMIX', label: 'VFormix' },
  { value: 'FUTURE_PRODUCT', label: 'Future Product' },
  { value: 'OTHER', label: 'Other' }
];

const PRODUCT_STATUSES: Array<{ value: ProductStatus; label: string }> = [
  { value: 'IDEA', label: 'Idea' },
  { value: 'PLANNING', label: 'Planning' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'LAUNCH_READY', label: 'Launch Ready' },
  { value: 'LIVE', label: 'Live' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' }
];

const ACTIVE_STATUSES = new Set<ProductStatus>(['IDEA', 'PLANNING', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'LAUNCH_READY', 'LIVE']);

@Component({
  selector: 'kravia-products',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './products.component.html'
})
export class ProductsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly categories = PRODUCT_CATEGORIES;
  readonly statuses = PRODUCT_STATUSES;
  readonly products = signal<ProductRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly status = signal<ProductStatus | ''>('');
  readonly developmentStage = signal('');
  readonly selected = signal<ProductRecord | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.status() || this.developmentStage().trim()));
  readonly summaryCards = computed(() => {
    const products = this.products();
    return [
      { label: 'Active Products', value: products.filter((product) => ACTIVE_STATUSES.has(product.status)).length, tone: 'neutral' },
      { label: 'Launch Ready', value: products.filter((product) => product.status === 'LAUNCH_READY').length, tone: 'positive' },
      { label: 'Paused', value: products.filter((product) => product.status === 'PAUSED').length, tone: 'warning' },
      { label: 'With Risks', value: products.filter((product) => Boolean(product.risks?.trim())).length, tone: 'critical' }
    ];
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    category: ['OTHER' as ProductCategory, Validators.required],
    description: ['', Validators.maxLength(3000)],
    status: ['IDEA' as ProductStatus, Validators.required],
    developmentStage: ['', [Validators.required, Validators.maxLength(255)]],
    launchReadinessPercentage: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    targetUsers: ['', Validators.maxLength(1500)],
    pricingNotes: ['', Validators.maxLength(1500)],
    revenueNotes: ['', Validators.maxLength(1500)],
    keyFeatures: ['', Validators.maxLength(3000)],
    pendingWork: ['', Validators.maxLength(3000)],
    risks: ['', Validators.maxLength(3000)],
    nextMilestone: ['', Validators.maxLength(255)],
    responsiblePerson: ['', Validators.maxLength(255)]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.products({ query: this.query(), status: this.status(), developmentStage: this.developmentStage() }).subscribe({
      next: (products) => {
        this.products.set(products);
        const selectedId = this.selected()?.id;
        this.selected.set(products.find((product) => product.id === selectedId) ?? products[0] ?? null);
      },
      error: () => this.error.set('Unable to load product records.'),
      complete: () => this.loading.set(false)
    });
  }

  applySearch(value: string): void { this.query.set(value); this.load(); }
  applyStatus(value: string): void { this.status.set(value as ProductStatus | ''); this.load(); }
  applyDevelopmentStage(value: string): void { this.developmentStage.set(value); this.load(); }

  clearFilters(): void {
    this.query.set('');
    this.status.set('');
    this.developmentStage.set('');
    this.load();
  }

  select(product: ProductRecord): void {
    this.selected.set(product);
    if (this.editingId() !== product.id) this.editingId.set(null);
  }

  startEdit(product: ProductRecord): void {
    if (!this.canEditProduct(product)) return;
    this.select(product);
    this.editingId.set(product.id);
    this.form.reset({
      name: product.name,
      category: product.category,
      description: product.description ?? '',
      status: product.status,
      developmentStage: product.developmentStage,
      launchReadinessPercentage: product.launchReadinessPercentage,
      targetUsers: product.targetUsers ?? '',
      pricingNotes: product.pricingNotes ?? '',
      revenueNotes: product.revenueNotes ?? '',
      keyFeatures: product.keyFeatures ?? '',
      pendingWork: product.pendingWork ?? '',
      risks: product.risks ?? '',
      nextMilestone: product.nextMilestone ?? '',
      responsiblePerson: product.responsiblePerson ?? ''
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
    const request = editingId ? this.api.updateProduct(editingId, payload) : this.api.createProduct(payload);
    request.subscribe({
      next: (product) => {
        this.selected.set(product);
        this.editingId.set(null);
        this.resetForm();
        this.success.set(editingId ? 'Product record saved.' : 'Product record created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Product record could not be saved.' : 'Product record could not be created.')
    });
  }

  archive(product: ProductRecord): void {
    if (!this.canArchive() || product.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveProduct(product.id).subscribe({
      next: () => {
        this.success.set('Product record archived.');
        this.load();
      },
      error: () => this.error.set('Product record could not be archived.')
    });
  }

  canEditProduct(product: ProductRecord): boolean { return this.canEdit() && product.status !== 'ARCHIVED'; }
  isActive(status: ProductStatus): boolean { return ACTIVE_STATUSES.has(status); }
  categoryLabel(value: ProductCategory): string { return this.categories.find((category) => category.value === value)?.label ?? value; }
  statusLabel(value: ProductStatus): string { return this.statuses.find((status) => status.value === value)?.label ?? value; }
  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }
  formatDateTime(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.'; }

  private payload(): ProductRequest {
    const values = this.form.getRawValue();
    return {
      name: values.name.trim(),
      category: values.category,
      description: values.description.trim() || undefined,
      status: values.status,
      developmentStage: values.developmentStage.trim(),
      launchReadinessPercentage: this.toNumber(values.launchReadinessPercentage),
      targetUsers: values.targetUsers.trim() || undefined,
      pricingNotes: values.pricingNotes.trim() || undefined,
      revenueNotes: values.revenueNotes.trim() || undefined,
      keyFeatures: values.keyFeatures.trim() || undefined,
      pendingWork: values.pendingWork.trim() || undefined,
      risks: values.risks.trim() || undefined,
      nextMilestone: values.nextMilestone.trim() || undefined,
      responsiblePerson: values.responsiblePerson.trim() || undefined
    };
  }

  private validationMessage(): string {
    const values = this.form.getRawValue();
    const readiness = this.toNumber(values.launchReadinessPercentage);
    if (readiness < 0 || readiness > 100) return 'Launch readiness must be between 0 and 100.';
    if (this.isActive(values.status) && !values.responsiblePerson.trim()) return 'Responsible person is required when product is active.';
    return '';
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      category: 'OTHER',
      description: '',
      status: 'IDEA',
      developmentStage: '',
      launchReadinessPercentage: 0,
      targetUsers: '',
      pricingNotes: '',
      revenueNotes: '',
      keyFeatures: '',
      pendingWork: '',
      risks: '',
      nextMilestone: '',
      responsiblePerson: ''
    });
  }

  private toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}