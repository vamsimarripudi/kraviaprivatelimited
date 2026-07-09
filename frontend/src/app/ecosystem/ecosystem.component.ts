import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ApiService } from '../core/http/api.service';
import { EcosystemProductRecord, EcosystemProductRequest, EcosystemProductStatus, EcosystemSummary } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

type EcosystemView = 'dashboard' | 'registry' | 'health' | 'revenue' | 'roadmap' | 'launch' | 'risks';

const STATUSES: Array<{ value: EcosystemProductStatus; label: string }> = [
  { value: 'IDEA', label: 'Idea' },
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'TESTING', label: 'Testing' },
  { value: 'STAGING', label: 'Staging' },
  { value: 'LAUNCH_READY', label: 'Launch Ready' },
  { value: 'LIVE', label: 'Live' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ARCHIVED', label: 'Archived' }
];

const EMPTY_SUMMARY: EcosystemSummary = {
  registeredProducts: 0,
  activeProducts: 0,
  launchReadyProducts: 0,
  liveProducts: 0,
  archivedProducts: 0,
  healthTrackedProducts: 0,
  revenueVisibleProducts: 0,
  complianceVisibleProducts: 0,
  securityVisibleProducts: 0,
  deploymentTrackedProducts: 0,
  roadmapTrackedProducts: 0,
  productsWithRisks: 0
};

@Component({
  selector: 'kravia-ecosystem',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './ecosystem.component.html'
})
export class EcosystemComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly statuses = STATUSES;
  readonly views: Array<{ value: EcosystemView; label: string }> = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'registry', label: 'Registry' },
    { value: 'health', label: 'Health' },
    { value: 'revenue', label: 'Revenue' },
    { value: 'roadmap', label: 'Roadmap' },
    { value: 'launch', label: 'Launch' },
    { value: 'risks', label: 'Risks' }
  ];

  readonly view = signal<EcosystemView>('dashboard');
  readonly products = signal<EcosystemProductRecord[]>([]);
  readonly summary = signal<EcosystemSummary>(EMPTY_SUMMARY);
  readonly selected = signal<EcosystemProductRecord | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly statusEditingId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly status = signal<EcosystemProductStatus | ''>('');
  readonly owner = signal('');

  readonly canCreate = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly canUpdateStatus = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.status() || this.owner().trim()));
  readonly statusChoices = computed(() => this.canArchive() ? this.statuses : this.statuses.filter((status) => status.value !== 'ARCHIVED'));
  readonly summaryCards = computed(() => {
    const summary = this.summary();
    return [
      { label: 'Registered Products', value: summary.registeredProducts, tone: 'neutral' },
      { label: 'Active Products', value: summary.activeProducts, tone: 'positive' },
      { label: 'Launch Ready', value: summary.launchReadyProducts, tone: 'positive' },
      { label: 'Live Products', value: summary.liveProducts, tone: 'positive' },
      { label: 'Revenue Visible', value: summary.revenueVisibleProducts, tone: 'neutral' },
      { label: 'Compliance Visible', value: summary.complianceVisibleProducts, tone: 'neutral' },
      { label: 'Security Visible', value: summary.securityVisibleProducts, tone: 'neutral' },
      { label: 'Risks Registered', value: summary.productsWithRisks, tone: summary.productsWithRisks ? 'warning' : 'neutral' }
    ];
  });

  readonly form = this.fb.nonNullable.group({
    productName: ['', [Validators.required, Validators.maxLength(255)]],
    productCode: ['', [Validators.required, Validators.pattern(/^[A-Z0-9][A-Z0-9_-]{1,39}$/)]],
    status: ['IDEA' as EcosystemProductStatus, Validators.required],
    owner: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', Validators.maxLength(3000)],
    domain: ['', Validators.maxLength(255)],
    backendUrl: ['', Validators.maxLength(500)],
    frontendUrl: ['', Validators.maxLength(500)],
    currentVersion: ['', Validators.maxLength(80)],
    launchStatus: ['', Validators.maxLength(255)],
    revenueStatus: ['', Validators.maxLength(255)],
    complianceStatus: ['', Validators.maxLength(255)],
    securityStatus: ['', Validators.maxLength(255)],
    deploymentStatus: ['', Validators.maxLength(255)],
    healthNotes: ['', Validators.maxLength(3000)],
    revenueNotes: ['', Validators.maxLength(3000)],
    roadmapNotes: ['', Validators.maxLength(3000)],
    launchChecklist: ['', Validators.maxLength(3000)],
    riskRegister: ['', Validators.maxLength(3000)]
  });

  readonly statusForm = this.fb.nonNullable.group({
    status: ['IDEA' as EcosystemProductStatus, Validators.required]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.ecosystemSummary(),
      products: this.api.ecosystemProducts({ query: this.query(), status: this.status(), owner: this.owner() })
    }).subscribe({
      next: ({ summary, products }) => {
        this.summary.set(summary);
        this.products.set(products);
        const selectedId = this.selected()?.id;
        this.selected.set(products.find((product) => product.id === selectedId) ?? products[0] ?? null);
      },
      error: () => this.error.set('Unable to load ecosystem product records.'),
      complete: () => this.loading.set(false)
    });
  }

  setView(view: EcosystemView): void { this.view.set(view); }
  applySearch(value: string): void { this.query.set(value); this.load(); }
  applyStatus(value: string): void { this.status.set(value as EcosystemProductStatus | ''); this.load(); }
  applyOwner(value: string): void { this.owner.set(value); this.load(); }

  clearFilters(): void {
    this.query.set('');
    this.status.set('');
    this.owner.set('');
    this.load();
  }

  select(product: EcosystemProductRecord): void {
    this.selected.set(product);
    if (this.editingId() !== product.id) this.editingId.set(null);
    if (this.statusEditingId() !== product.id) this.statusEditingId.set(null);
  }

  startEdit(product: EcosystemProductRecord): void {
    if (!this.canCreate() || product.status === 'ARCHIVED') return;
    this.select(product);
    this.editingId.set(product.id);
    this.form.reset(this.formValues(product));
    this.view.set('registry');
  }

  startStatusUpdate(product: EcosystemProductRecord): void {
    if (!this.canUpdateStatus() || product.status === 'ARCHIVED') return;
    this.select(product);
    this.statusEditingId.set(product.id);
    this.statusForm.reset({ status: product.status });
    this.view.set('registry');
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.statusEditingId.set(null);
    this.resetForm();
  }

  submit(): void {
    if (!this.canCreate()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload = this.payload();
    this.error.set('');
    this.success.set('');
    const editingId = this.editingId();
    const request = editingId ? this.api.updateEcosystemProduct(editingId, payload) : this.api.createEcosystemProduct(payload);
    request.subscribe({
      next: (product) => {
        this.selected.set(product);
        this.editingId.set(null);
        this.resetForm();
        this.success.set(editingId ? 'Ecosystem product saved.' : 'Ecosystem product registered.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Ecosystem product could not be saved.' : 'Ecosystem product could not be registered.')
    });
  }

  submitStatus(): void {
    const product = this.selected();
    if (!product || !this.canUpdateStatus() || this.statusForm.invalid) return;
    const status = this.statusForm.controls.status.value;
    const payload = this.payloadFromProduct(product, status);
    this.error.set('');
    this.success.set('');
    this.api.updateEcosystemProduct(product.id, payload).subscribe({
      next: (updated) => {
        this.selected.set(updated);
        this.statusEditingId.set(null);
        this.success.set('Product status updated.');
        this.load();
      },
      error: () => this.error.set('Product status could not be updated.')
    });
  }

  archive(product: EcosystemProductRecord): void {
    if (!this.canArchive() || product.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveEcosystemProduct(product.id).subscribe({
      next: () => {
        this.success.set('Ecosystem product archived.');
        this.load();
      },
      error: () => this.error.set('Ecosystem product could not be archived.')
    });
  }

  statusLabel(value: EcosystemProductStatus): string { return this.statuses.find((status) => status.value === value)?.label ?? value; }
  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }
  formatDateTime(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.'; }

  private payload(): EcosystemProductRequest {
    const values = this.form.getRawValue();
    return {
      productName: values.productName.trim(),
      productCode: values.productCode.trim().toUpperCase(),
      status: values.status,
      owner: values.owner.trim(),
      description: values.description.trim() || undefined,
      domain: values.domain.trim() || undefined,
      backendUrl: values.backendUrl.trim() || undefined,
      frontendUrl: values.frontendUrl.trim() || undefined,
      currentVersion: values.currentVersion.trim() || undefined,
      launchStatus: values.launchStatus.trim() || undefined,
      revenueStatus: values.revenueStatus.trim() || undefined,
      complianceStatus: values.complianceStatus.trim() || undefined,
      securityStatus: values.securityStatus.trim() || undefined,
      deploymentStatus: values.deploymentStatus.trim() || undefined,
      healthNotes: values.healthNotes.trim() || undefined,
      revenueNotes: values.revenueNotes.trim() || undefined,
      roadmapNotes: values.roadmapNotes.trim() || undefined,
      launchChecklist: values.launchChecklist.trim() || undefined,
      riskRegister: values.riskRegister.trim() || undefined
    };
  }

  private payloadFromProduct(product: EcosystemProductRecord, status: EcosystemProductStatus): EcosystemProductRequest {
    return {
      productName: product.productName,
      productCode: product.productCode,
      status,
      owner: product.owner,
      description: product.description,
      domain: product.domain,
      backendUrl: product.backendUrl,
      frontendUrl: product.frontendUrl,
      currentVersion: product.currentVersion,
      launchStatus: product.launchStatus,
      revenueStatus: product.revenueStatus,
      complianceStatus: product.complianceStatus,
      securityStatus: product.securityStatus,
      deploymentStatus: product.deploymentStatus,
      healthNotes: product.healthNotes,
      revenueNotes: product.revenueNotes,
      roadmapNotes: product.roadmapNotes,
      launchChecklist: product.launchChecklist,
      riskRegister: product.riskRegister
    };
  }

  private formValues(product: EcosystemProductRecord) {
    return {
      productName: product.productName,
      productCode: product.productCode,
      status: product.status,
      owner: product.owner,
      description: product.description ?? '',
      domain: product.domain ?? '',
      backendUrl: product.backendUrl ?? '',
      frontendUrl: product.frontendUrl ?? '',
      currentVersion: product.currentVersion ?? '',
      launchStatus: product.launchStatus ?? '',
      revenueStatus: product.revenueStatus ?? '',
      complianceStatus: product.complianceStatus ?? '',
      securityStatus: product.securityStatus ?? '',
      deploymentStatus: product.deploymentStatus ?? '',
      healthNotes: product.healthNotes ?? '',
      revenueNotes: product.revenueNotes ?? '',
      roadmapNotes: product.roadmapNotes ?? '',
      launchChecklist: product.launchChecklist ?? '',
      riskRegister: product.riskRegister ?? ''
    };
  }

  private resetForm(): void {
    this.form.reset({
      productName: '',
      productCode: '',
      status: 'IDEA',
      owner: '',
      description: '',
      domain: '',
      backendUrl: '',
      frontendUrl: '',
      currentVersion: '',
      launchStatus: '',
      revenueStatus: '',
      complianceStatus: '',
      securityStatus: '',
      deploymentStatus: '',
      healthNotes: '',
      revenueNotes: '',
      roadmapNotes: '',
      launchChecklist: '',
      riskRegister: ''
    });
  }
}
