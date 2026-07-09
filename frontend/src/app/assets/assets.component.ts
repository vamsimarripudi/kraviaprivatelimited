import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ApiService } from '../core/http/api.service';
import { AssetAssignmentRecord, AssetCategory, AssetDocumentRecord, AssetMaintenanceRecord, AssetRecord, AssetReport, AssetReportType, AssetStatus, AssetSummary, CloudResourceRecord, ProcurementVendorRecord, SoftwareLicenseRecord } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

type AssetTab = 'dashboard' | 'register' | 'assignments' | 'maintenance' | 'licenses' | 'cloud' | 'documents' | 'reports';

@Component({
  selector: 'kravia-assets',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './assets.component.html'
})
export class AssetsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly tabs: Array<{ value: AssetTab; label: string }> = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'register', label: 'Asset Register' },
    { value: 'assignments', label: 'Assignments' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'licenses', label: 'Licenses' },
    { value: 'cloud', label: 'Cloud Resources' },
    { value: 'documents', label: 'Documents' },
    { value: 'reports', label: 'Reports' }
  ];
  readonly categories: AssetCategory[] = ['LAPTOP', 'MOBILE', 'SERVER', 'CLOUD_RESOURCE', 'SOFTWARE_LICENSE', 'DOMAIN', 'SSL_CERTIFICATE', 'OFFICE_EQUIPMENT', 'FURNITURE', 'NETWORK_DEVICE', 'OTHER'];
  readonly statuses: AssetStatus[] = ['ACTIVE', 'ASSIGNED', 'UNASSIGNED', 'UNDER_MAINTENANCE', 'EXPIRED', 'LOST', 'SOLD', 'RETIRED', 'ARCHIVED'];
  readonly reportTypes: AssetReportType[] = ['ASSET_REGISTER', 'ASSIGNMENTS', 'MAINTENANCE', 'SOFTWARE_LICENSES', 'CLOUD_RESOURCES', 'DEPRECIATION', 'WARRANTY_EXPIRY', 'DOCUMENT_LINKS'];

  readonly activeTab = signal<AssetTab>('dashboard');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly summary = signal<AssetSummary | null>(null);
  readonly assetRecords = signal<AssetRecord[]>([]);
  readonly assignments = signal<AssetAssignmentRecord[]>([]);
  readonly maintenanceRecords = signal<AssetMaintenanceRecord[]>([]);
  readonly licenses = signal<SoftwareLicenseRecord[]>([]);
  readonly cloudResources = signal<CloudResourceRecord[]>([]);
  readonly assetDocuments = signal<AssetDocumentRecord[]>([]);
  readonly vendors = signal<ProcurementVendorRecord[]>([]);
  readonly report = signal<AssetReport | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly currentUserName = computed(() => this.auth.user()?.displayName || this.auth.user()?.email || 'KRAVIA user');

  readonly editingAssetId = signal<string | null>(null);
  readonly editingAssignmentId = signal<string | null>(null);
  readonly editingMaintenanceId = signal<string | null>(null);
  readonly editingLicenseId = signal<string | null>(null);
  readonly editingCloudId = signal<string | null>(null);
  readonly editingDocumentId = signal<string | null>(null);

  readonly assetFilterForm = this.fb.nonNullable.group({ query: [''], category: ['' as AssetCategory | ''], status: ['' as AssetStatus | ''] });
  readonly statusFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as AssetStatus | ''] });

  readonly assetForm = this.fb.nonNullable.group({
    assetName: ['', Validators.required],
    assetCode: ['', Validators.required],
    category: ['LAPTOP' as AssetCategory, Validators.required],
    description: [''],
    purchaseDate: [''],
    purchaseCost: [0, [Validators.min(0)]],
    vendorId: [''],
    assignedTo: [''],
    location: [''],
    status: ['UNASSIGNED' as AssetStatus, Validators.required],
    warrantyStartDate: [''],
    warrantyEndDate: [''],
    renewalDate: [''],
    relatedDocumentId: [''],
    notes: ['']
  });

  readonly assignmentForm = this.fb.nonNullable.group({
    assetId: ['', Validators.required],
    assignedTo: ['', Validators.required],
    assignedBy: [''],
    assignedDate: ['', Validators.required],
    returnDate: [''],
    location: [''],
    status: ['ASSIGNED' as AssetStatus, Validators.required],
    notes: ['']
  });

  readonly maintenanceForm = this.fb.nonNullable.group({
    assetId: ['', Validators.required],
    maintenanceTitle: ['', Validators.required],
    maintenanceType: [''],
    serviceProvider: [''],
    maintenanceDate: ['', Validators.required],
    nextMaintenanceDate: [''],
    cost: [0, [Validators.min(0)]],
    status: ['UNDER_MAINTENANCE' as AssetStatus, Validators.required],
    notes: ['']
  });

  readonly licenseForm = this.fb.nonNullable.group({
    assetId: [''],
    licenseName: ['', Validators.required],
    provider: [''],
    licenseKeyReference: [''],
    seats: [0, [Validators.min(0)]],
    assignedSeats: [0, [Validators.min(0)]],
    renewalDate: [''],
    status: ['ACTIVE' as AssetStatus, Validators.required],
    relatedDocumentId: [''],
    notes: ['']
  });

  readonly cloudForm = this.fb.nonNullable.group({
    assetId: [''],
    resourceName: ['', Validators.required],
    provider: [''],
    resourceType: [''],
    region: [''],
    environment: [''],
    monthlyCost: [0, [Validators.min(0)]],
    owner: [''],
    status: ['ACTIVE' as AssetStatus, Validators.required],
    relatedDocumentId: [''],
    notes: ['']
  });

  readonly documentForm = this.fb.nonNullable.group({
    assetId: ['', Validators.required],
    documentId: ['', Validators.required],
    documentPurpose: [''],
    status: ['ACTIVE' as AssetStatus, Validators.required]
  });

  readonly reportForm = this.fb.nonNullable.group({ reportType: ['ASSET_REGISTER' as AssetReportType, Validators.required] });

  constructor() { this.load(); }

  setTab(tab: AssetTab): void { this.activeTab.set(tab); this.error.set(''); this.success.set(''); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.assetSummary(),
      assets: this.api.assets(this.assetFilterForm.getRawValue()),
      assignments: this.api.assetAssignments(this.statusFilterForm.getRawValue()),
      maintenance: this.api.assetMaintenance(this.statusFilterForm.getRawValue()),
      licenses: this.api.softwareLicenses(this.statusFilterForm.getRawValue()),
      cloudResources: this.api.cloudResources(this.statusFilterForm.getRawValue()),
      assetDocuments: this.api.assetDocuments(this.statusFilterForm.getRawValue()),
      vendors: this.api.procurementVendors({ query: '', category: '', status: '' })
    }).subscribe({
      next: (result) => {
        this.summary.set(result.summary);
        this.assetRecords.set(result.assets);
        this.assignments.set(result.assignments);
        this.maintenanceRecords.set(result.maintenance);
        this.licenses.set(result.licenses);
        this.cloudResources.set(result.cloudResources);
        this.assetDocuments.set(result.assetDocuments);
        this.vendors.set(result.vendors);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Asset records could not be loaded.');
        this.loading.set(false);
      }
    });
  }

  saveAsset(): void { if (this.assetForm.invalid) return; const value = this.assetForm.getRawValue(); const payload = { ...this.clean(value), purchaseCost: this.toNumber(value.purchaseCost) }; const id = this.editingAssetId(); this.run(id ? this.api.updateAsset(id, payload) : this.api.createAsset(payload), id ? 'Asset updated.' : 'Asset created.', () => this.resetAssetForm()); }
  saveAssignment(): void { if (this.assignmentForm.invalid) return; const value = this.assignmentForm.getRawValue(); const payload = { ...this.clean(value), assignedBy: value.assignedBy || this.currentUserName() }; const id = this.editingAssignmentId(); this.run(id ? this.api.updateAssetAssignment(id, payload) : this.api.createAssetAssignment(payload), id ? 'Assignment updated.' : 'Assignment created.', () => this.resetAssignmentForm()); }
  saveMaintenance(): void { if (this.maintenanceForm.invalid) return; const value = this.maintenanceForm.getRawValue(); const payload = { ...this.clean(value), cost: this.toNumber(value.cost) }; const id = this.editingMaintenanceId(); this.run(id ? this.api.updateAssetMaintenance(id, payload) : this.api.createAssetMaintenance(payload), id ? 'Maintenance record updated.' : 'Maintenance record created.', () => this.resetMaintenanceForm()); }
  saveLicense(): void { if (this.licenseForm.invalid) return; const value = this.licenseForm.getRawValue(); const payload = { ...this.clean(value), seats: this.toNumber(value.seats), assignedSeats: this.toNumber(value.assignedSeats) }; const id = this.editingLicenseId(); this.run(id ? this.api.updateSoftwareLicense(id, payload) : this.api.createSoftwareLicense(payload), id ? 'License updated.' : 'License created.', () => this.resetLicenseForm()); }
  saveCloudResource(): void { if (this.cloudForm.invalid) return; const value = this.cloudForm.getRawValue(); const payload = { ...this.clean(value), monthlyCost: this.toNumber(value.monthlyCost) }; const id = this.editingCloudId(); this.run(id ? this.api.updateCloudResource(id, payload) : this.api.createCloudResource(payload), id ? 'Cloud resource updated.' : 'Cloud resource created.', () => this.resetCloudForm()); }
  saveDocument(): void { if (this.documentForm.invalid) return; const payload = this.clean(this.documentForm.getRawValue()); const id = this.editingDocumentId(); this.run(id ? this.api.updateAssetDocument(id, payload) : this.api.createAssetDocument(payload), id ? 'Asset document updated.' : 'Asset document linked.', () => this.resetDocumentForm()); }

  editAsset(asset: AssetRecord): void { if (!this.canEdit()) return; this.editingAssetId.set(asset.id); this.assetForm.reset({ assetName: asset.assetName, assetCode: asset.assetCode, category: asset.category, description: asset.description || '', purchaseDate: asset.purchaseDate || '', purchaseCost: asset.purchaseCost || 0, vendorId: asset.vendorId || '', assignedTo: asset.assignedTo || '', location: asset.location || '', status: asset.status, warrantyStartDate: asset.warrantyStartDate || '', warrantyEndDate: asset.warrantyEndDate || '', renewalDate: asset.renewalDate || '', relatedDocumentId: asset.relatedDocumentId || '', notes: asset.notes || '' }); }
  editAssignment(record: AssetAssignmentRecord): void { if (!this.canEdit()) return; this.editingAssignmentId.set(record.id); this.assignmentForm.reset({ assetId: record.assetId, assignedTo: record.assignedTo, assignedBy: record.assignedBy || '', assignedDate: record.assignedDate, returnDate: record.returnDate || '', location: record.location || '', status: record.status, notes: record.notes || '' }); }
  editMaintenance(record: AssetMaintenanceRecord): void { if (!this.canEdit()) return; this.editingMaintenanceId.set(record.id); this.maintenanceForm.reset({ assetId: record.assetId, maintenanceTitle: record.maintenanceTitle, maintenanceType: record.maintenanceType || '', serviceProvider: record.serviceProvider || '', maintenanceDate: record.maintenanceDate, nextMaintenanceDate: record.nextMaintenanceDate || '', cost: record.cost || 0, status: record.status, notes: record.notes || '' }); }
  editLicense(record: SoftwareLicenseRecord): void { if (!this.canEdit()) return; this.editingLicenseId.set(record.id); this.licenseForm.reset({ assetId: record.assetId || '', licenseName: record.licenseName, provider: record.provider || '', licenseKeyReference: record.licenseKeyReference || '', seats: record.seats || 0, assignedSeats: record.assignedSeats || 0, renewalDate: record.renewalDate || '', status: record.status, relatedDocumentId: record.relatedDocumentId || '', notes: record.notes || '' }); }
  editCloudResource(record: CloudResourceRecord): void { if (!this.canEdit()) return; this.editingCloudId.set(record.id); this.cloudForm.reset({ assetId: record.assetId || '', resourceName: record.resourceName, provider: record.provider || '', resourceType: record.resourceType || '', region: record.region || '', environment: record.environment || '', monthlyCost: record.monthlyCost || 0, owner: record.owner || '', status: record.status, relatedDocumentId: record.relatedDocumentId || '', notes: record.notes || '' }); }
  editDocument(record: AssetDocumentRecord): void { if (!this.canEdit()) return; this.editingDocumentId.set(record.id); this.documentForm.reset({ assetId: record.assetId, documentId: record.documentId, documentPurpose: record.documentPurpose || '', status: record.status }); }

  archive(kind: AssetTab, id: string): void {
    if (!this.canArchive()) return;
    const request = this.archiveRequest(kind, id);
    if (!request) return;
    this.run(request, 'Asset record archived.');
  }

  generateReport(): void {
    this.api.assetReport(this.reportForm.getRawValue().reportType).subscribe({
      next: (report) => this.report.set(report),
      error: () => this.error.set('Asset report could not be generated.')
    });
  }

  resetAssetForm(): void { this.editingAssetId.set(null); this.assetForm.reset({ assetName: '', assetCode: '', category: 'LAPTOP', description: '', purchaseDate: '', purchaseCost: 0, vendorId: '', assignedTo: '', location: '', status: 'UNASSIGNED', warrantyStartDate: '', warrantyEndDate: '', renewalDate: '', relatedDocumentId: '', notes: '' }); }
  resetAssignmentForm(): void { this.editingAssignmentId.set(null); this.assignmentForm.reset({ assetId: '', assignedTo: '', assignedBy: '', assignedDate: '', returnDate: '', location: '', status: 'ASSIGNED', notes: '' }); }
  resetMaintenanceForm(): void { this.editingMaintenanceId.set(null); this.maintenanceForm.reset({ assetId: '', maintenanceTitle: '', maintenanceType: '', serviceProvider: '', maintenanceDate: '', nextMaintenanceDate: '', cost: 0, status: 'UNDER_MAINTENANCE', notes: '' }); }
  resetLicenseForm(): void { this.editingLicenseId.set(null); this.licenseForm.reset({ assetId: '', licenseName: '', provider: '', licenseKeyReference: '', seats: 0, assignedSeats: 0, renewalDate: '', status: 'ACTIVE', relatedDocumentId: '', notes: '' }); }
  resetCloudForm(): void { this.editingCloudId.set(null); this.cloudForm.reset({ assetId: '', resourceName: '', provider: '', resourceType: '', region: '', environment: '', monthlyCost: 0, owner: '', status: 'ACTIVE', relatedDocumentId: '', notes: '' }); }
  resetDocumentForm(): void { this.editingDocumentId.set(null); this.documentForm.reset({ assetId: '', documentId: '', documentPurpose: '', status: 'ACTIVE' }); }

  label(value: string | null | undefined): string { return value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'No information has been added yet.'; }
  currency(value: number | null | undefined): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  upcoming(date: string | null | undefined): boolean { if (!date) return false; const today = new Date(new Date().toDateString()); const target = new Date(date); const next = new Date(today); next.setDate(today.getDate() + 30); return target >= today && target <= next; }
  assetName(id: string | null | undefined): string { return this.assetRecords().find((asset) => asset.id === id)?.assetName || 'No asset selected'; }
  vendorName(id: string | null | undefined): string { return this.vendors().find((vendor) => vendor.id === id)?.vendorName || 'No vendor selected'; }
  print(): void { window.print(); }

  private archiveRequest(kind: AssetTab, id: string): Observable<void> | null {
    if (kind === 'register') return this.api.archiveAsset(id);
    if (kind === 'assignments') return this.api.archiveAssetAssignment(id);
    if (kind === 'maintenance') return this.api.archiveAssetMaintenance(id);
    if (kind === 'licenses') return this.api.archiveSoftwareLicense(id);
    if (kind === 'cloud') return this.api.archiveCloudResource(id);
    if (kind === 'documents') return this.api.archiveAssetDocument(id);
    return null;
  }

  private run<T>(request: Observable<T>, message: string, afterSuccess?: () => void): void {
    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: () => {
        this.success.set(message);
        this.saving.set(false);
        afterSuccess?.();
        this.load();
      },
      error: () => {
        this.error.set('Asset record could not be saved.');
        this.saving.set(false);
      }
    });
  }

  private toNumber(value: number | string | null | undefined): number { return Number(value || 0); }
  private clean<T extends Record<string, unknown>>(payload: T): T { return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === '' ? undefined : value])) as T; }
}
