import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ProcurementApprovalRecord, ProcurementPriority, ProcurementReport, ProcurementReportType, ProcurementStatus, ProcurementSubscriptionRecord, ProcurementSummary, ProcurementVendorRecord, PurchaseOrderRecord, PurchaseRequestRecord, VendorBillRecord, VendorCategory, VendorDocumentRecord } from '../core/models/api.models';

type ProcurementTab = 'dashboard' | 'vendors' | 'requests' | 'orders' | 'bills' | 'subscriptions' | 'approvals' | 'documents' | 'reports';

@Component({
  selector: 'kravia-procurement',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './procurement.component.html'
})
export class ProcurementComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly tabs: Array<{ value: ProcurementTab; label: string }> = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'vendors', label: 'Vendor Master' },
    { value: 'requests', label: 'Purchase Requests' },
    { value: 'orders', label: 'Purchase Orders' },
    { value: 'bills', label: 'Vendor Bills' },
    { value: 'subscriptions', label: 'Subscriptions' },
    { value: 'approvals', label: 'Approvals' },
    { value: 'documents', label: 'Vendor Documents' },
    { value: 'reports', label: 'Reports' }
  ];
  readonly categories: VendorCategory[] = ['SOFTWARE', 'CLOUD', 'LEGAL', 'COMPLIANCE', 'BANKING', 'DESIGN', 'DEVELOPMENT', 'MARKETING', 'OFFICE', 'OTHER'];
  readonly statuses: ProcurementStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ACTIVE', 'PAID', 'UNPAID', 'OVERDUE', 'CANCELLED', 'ARCHIVED'];
  readonly priorities: ProcurementPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  readonly reportTypes: ProcurementReportType[] = ['VENDOR_SUMMARY', 'PURCHASE_REQUESTS', 'PURCHASE_ORDERS', 'VENDOR_BILLS', 'SUBSCRIPTIONS', 'APPROVALS', 'OVERDUE_PAYMENTS'];

  readonly activeTab = signal<ProcurementTab>('dashboard');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly summary = signal<ProcurementSummary | null>(null);
  readonly vendors = signal<ProcurementVendorRecord[]>([]);
  readonly requests = signal<PurchaseRequestRecord[]>([]);
  readonly orders = signal<PurchaseOrderRecord[]>([]);
  readonly bills = signal<VendorBillRecord[]>([]);
  readonly subscriptions = signal<ProcurementSubscriptionRecord[]>([]);
  readonly approvals = signal<ProcurementApprovalRecord[]>([]);
  readonly vendorDocuments = signal<VendorDocumentRecord[]>([]);
  readonly report = signal<ProcurementReport | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly currentUserName = computed(() => this.auth.user()?.displayName || this.auth.user()?.email || 'KRAVIA user');
  readonly editingVendorId = signal<string | null>(null);
  readonly editingRequestId = signal<string | null>(null);
  readonly editingOrderId = signal<string | null>(null);
  readonly editingBillId = signal<string | null>(null);
  readonly editingSubscriptionId = signal<string | null>(null);
  readonly editingApprovalId = signal<string | null>(null);
  readonly editingVendorDocumentId = signal<string | null>(null);

  readonly vendorFilterForm = this.fb.nonNullable.group({ query: [''], category: ['' as VendorCategory | ''], status: ['' as ProcurementStatus | ''] });
  readonly statusFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as ProcurementStatus | ''] });
  readonly billFilterForm = this.fb.nonNullable.group({ query: [''], paymentStatus: ['' as ProcurementStatus | ''] });

  readonly vendorForm = this.fb.nonNullable.group({
    vendorName: ['', Validators.required],
    category: ['SOFTWARE' as VendorCategory, Validators.required],
    contactPerson: [''],
    phone: [''],
    email: ['', Validators.email],
    gstin: [''],
    pan: [''],
    address: [''],
    serviceType: [''],
    status: ['ACTIVE' as ProcurementStatus, Validators.required],
    notes: ['']
  });

  readonly requestForm = this.fb.nonNullable.group({
    requestTitle: ['', Validators.required],
    vendorId: [''],
    purpose: ['', Validators.required],
    estimatedAmount: [0, [Validators.required, Validators.min(0)]],
    priority: ['MEDIUM' as ProcurementPriority, Validators.required],
    requestedBy: [''],
    requiredDate: [''],
    status: ['DRAFT' as ProcurementStatus, Validators.required],
    approvalStatus: ['PENDING_APPROVAL' as ProcurementStatus, Validators.required],
    notes: ['']
  });

  readonly orderForm = this.fb.nonNullable.group({
    poNumber: ['', Validators.required],
    vendorId: ['', Validators.required],
    itemsOrServices: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    taxes: [0, [Validators.required, Validators.min(0)]],
    issueDate: ['', Validators.required],
    dueDate: [''],
    status: ['APPROVED' as ProcurementStatus, Validators.required],
    linkedDocumentId: ['']
  });

  readonly billForm = this.fb.nonNullable.group({
    billNumber: ['', Validators.required],
    vendorId: ['', Validators.required],
    billDate: ['', Validators.required],
    dueDate: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    gst: [0, [Validators.required, Validators.min(0)]],
    paymentStatus: ['UNPAID' as ProcurementStatus, Validators.required],
    linkedPurchaseOrderId: [''],
    linkedDocumentId: [''],
    linkedFinancePayableId: ['']
  });

  readonly subscriptionForm = this.fb.nonNullable.group({
    serviceName: ['', Validators.required],
    vendorId: [''],
    plan: [''],
    billingCycle: ['MONTHLY'],
    amount: [0, [Validators.required, Validators.min(0)]],
    renewalDate: [''],
    autoRenewalEnabled: [false],
    owner: [''],
    status: ['ACTIVE' as ProcurementStatus, Validators.required]
  });

  readonly approvalForm = this.fb.nonNullable.group({
    approvalTitle: ['', Validators.required],
    approvalType: ['VENDOR_PAYMENT', Validators.required],
    status: ['PENDING_APPROVAL' as ProcurementStatus, Validators.required],
    approver: [''],
    approvalNotes: [''],
    approvalDate: [''],
    rejectionReason: [''],
    linkedRecordType: [''],
    linkedRecordId: ['']
  });

  readonly vendorDocumentForm = this.fb.nonNullable.group({
    vendorId: ['', Validators.required],
    documentId: ['', Validators.required],
    documentPurpose: [''],
    status: ['ACTIVE' as ProcurementStatus, Validators.required]
  });

  readonly reportForm = this.fb.nonNullable.group({ reportType: ['VENDOR_SUMMARY' as ProcurementReportType, Validators.required] });

  constructor() { this.load(); }

  setTab(tab: ProcurementTab): void { this.activeTab.set(tab); this.error.set(''); this.success.set(''); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.procurementSummary(),
      vendors: this.api.procurementVendors(this.vendorFilterForm.getRawValue()),
      requests: this.api.purchaseRequests(this.statusFilterForm.getRawValue()),
      orders: this.api.purchaseOrders(this.statusFilterForm.getRawValue()),
      bills: this.api.vendorBills(this.billFilterForm.getRawValue()),
      subscriptions: this.api.procurementSubscriptions(this.statusFilterForm.getRawValue()),
      approvals: this.api.procurementApprovals(this.statusFilterForm.getRawValue()),
      vendorDocuments: this.api.vendorDocuments(this.statusFilterForm.getRawValue())
    }).subscribe({
      next: (result) => {
        this.summary.set(result.summary);
        this.vendors.set(result.vendors);
        this.requests.set(result.requests);
        this.orders.set(result.orders);
        this.bills.set(result.bills);
        this.subscriptions.set(result.subscriptions);
        this.approvals.set(result.approvals);
        this.vendorDocuments.set(result.vendorDocuments);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Procurement records could not be loaded.');
        this.loading.set(false);
      }
    });
  }

  createVendor(): void { if (this.vendorForm.invalid) return; const payload = this.clean(this.vendorForm.getRawValue()); const id = this.editingVendorId(); this.run(id ? this.api.updateProcurementVendor(id, payload) : this.api.createProcurementVendor(payload), id ? 'Vendor record updated.' : 'Vendor record created.', () => this.resetVendorForm()); }
  createRequest(): void { if (this.requestForm.invalid) return; const value = this.requestForm.getRawValue(); const payload = { ...this.clean(value), estimatedAmount: this.toNumber(value.estimatedAmount), requestedBy: value.requestedBy || this.currentUserName() }; const id = this.editingRequestId(); this.run(id ? this.api.updatePurchaseRequest(id, payload) : this.api.createPurchaseRequest(payload), id ? 'Purchase request updated.' : 'Purchase request created.', () => this.resetRequestForm()); }
  createOrder(): void { if (this.orderForm.invalid) return; const value = this.orderForm.getRawValue(); const payload = { ...this.clean(value), amount: this.toNumber(value.amount), taxes: this.toNumber(value.taxes) }; const id = this.editingOrderId(); this.run(id ? this.api.updatePurchaseOrder(id, payload) : this.api.createPurchaseOrder(payload), id ? 'Purchase order updated.' : 'Purchase order created.', () => this.resetOrderForm()); }
  createBill(): void { if (this.billForm.invalid) return; const value = this.billForm.getRawValue(); const payload = { ...this.clean(value), amount: this.toNumber(value.amount), gst: this.toNumber(value.gst) }; const id = this.editingBillId(); this.run(id ? this.api.updateVendorBill(id, payload) : this.api.createVendorBill(payload), id ? 'Vendor bill updated.' : 'Vendor bill created.', () => this.resetBillForm()); }
  createSubscription(): void { if (this.subscriptionForm.invalid) return; const value = this.subscriptionForm.getRawValue(); const payload = { ...this.clean(value), amount: this.toNumber(value.amount) }; const id = this.editingSubscriptionId(); this.run(id ? this.api.updateProcurementSubscription(id, payload) : this.api.createProcurementSubscription(payload), id ? 'Subscription record updated.' : 'Subscription record created.', () => this.resetSubscriptionForm()); }
  createApproval(): void { if (this.approvalForm.invalid) return; const payload = this.clean(this.approvalForm.getRawValue()); const id = this.editingApprovalId(); this.run(id ? this.api.updateProcurementApproval(id, payload) : this.api.createProcurementApproval(payload), id ? 'Procurement approval updated.' : 'Procurement approval created.', () => this.resetApprovalForm()); }
  createVendorDocument(): void { if (this.vendorDocumentForm.invalid) return; const payload = this.clean(this.vendorDocumentForm.getRawValue()); const id = this.editingVendorDocumentId(); this.run(id ? this.api.updateVendorDocument(id, payload) : this.api.createVendorDocument(payload), id ? 'Vendor document updated.' : 'Vendor document linked.', () => this.resetVendorDocumentForm()); }

  editVendor(vendor: ProcurementVendorRecord): void { if (!this.canEdit()) return; this.editingVendorId.set(vendor.id); this.vendorForm.reset({ vendorName: vendor.vendorName, category: vendor.category, contactPerson: vendor.contactPerson || '', phone: vendor.phone || '', email: vendor.email || '', gstin: vendor.gstin || '', pan: vendor.pan || '', address: vendor.address || '', serviceType: vendor.serviceType || '', status: vendor.status, notes: vendor.notes || '' }); }
  editRequest(request: PurchaseRequestRecord): void { if (!this.canEdit()) return; this.editingRequestId.set(request.id); this.requestForm.reset({ requestTitle: request.requestTitle, vendorId: request.vendorId || '', purpose: request.purpose, estimatedAmount: request.estimatedAmount, priority: request.priority, requestedBy: request.requestedBy || '', requiredDate: request.requiredDate || '', status: request.status, approvalStatus: request.approvalStatus, notes: request.notes || '' }); }
  editOrder(order: PurchaseOrderRecord): void { if (!this.canEdit()) return; this.editingOrderId.set(order.id); this.orderForm.reset({ poNumber: order.poNumber, vendorId: order.vendorId, itemsOrServices: order.itemsOrServices, amount: order.amount, taxes: order.taxes, issueDate: order.issueDate, dueDate: order.dueDate || '', status: order.status, linkedDocumentId: order.linkedDocumentId || '' }); }
  editBill(bill: VendorBillRecord): void { if (!this.canEdit()) return; this.editingBillId.set(bill.id); this.billForm.reset({ billNumber: bill.billNumber, vendorId: bill.vendorId, billDate: bill.billDate, dueDate: bill.dueDate, amount: bill.amount, gst: bill.gst, paymentStatus: bill.paymentStatus, linkedPurchaseOrderId: bill.linkedPurchaseOrderId || '', linkedDocumentId: bill.linkedDocumentId || '', linkedFinancePayableId: bill.linkedFinancePayableId || '' }); }
  editSubscription(subscription: ProcurementSubscriptionRecord): void { if (!this.canEdit()) return; this.editingSubscriptionId.set(subscription.id); this.subscriptionForm.reset({ serviceName: subscription.serviceName, vendorId: subscription.vendorId || '', plan: subscription.plan || '', billingCycle: subscription.billingCycle || 'MONTHLY', amount: subscription.amount, renewalDate: subscription.renewalDate || '', autoRenewalEnabled: subscription.autoRenewalEnabled, owner: subscription.owner || '', status: subscription.status }); }
  editApproval(approval: ProcurementApprovalRecord): void { if (!this.canEdit()) return; this.editingApprovalId.set(approval.id); this.approvalForm.reset({ approvalTitle: approval.approvalTitle, approvalType: approval.approvalType, status: approval.status, approver: approval.approver || '', approvalNotes: approval.approvalNotes || '', approvalDate: approval.approvalDate || '', rejectionReason: approval.rejectionReason || '', linkedRecordType: approval.linkedRecordType || '', linkedRecordId: approval.linkedRecordId || '' }); }
  editVendorDocument(document: VendorDocumentRecord): void { if (!this.canEdit()) return; this.editingVendorDocumentId.set(document.id); this.vendorDocumentForm.reset({ vendorId: document.vendorId, documentId: document.documentId, documentPurpose: document.documentPurpose || '', status: document.status }); }

  resetVendorForm(): void { this.editingVendorId.set(null); this.vendorForm.reset({ vendorName: '', category: 'SOFTWARE', contactPerson: '', phone: '', email: '', gstin: '', pan: '', address: '', serviceType: '', status: 'ACTIVE', notes: '' }); }
  resetRequestForm(): void { this.editingRequestId.set(null); this.requestForm.reset({ requestTitle: '', vendorId: '', purpose: '', estimatedAmount: 0, priority: 'MEDIUM', requestedBy: '', requiredDate: '', status: 'DRAFT', approvalStatus: 'PENDING_APPROVAL', notes: '' }); }
  resetOrderForm(): void { this.editingOrderId.set(null); this.orderForm.reset({ poNumber: '', vendorId: '', itemsOrServices: '', amount: 0, taxes: 0, issueDate: '', dueDate: '', status: 'APPROVED', linkedDocumentId: '' }); }
  resetBillForm(): void { this.editingBillId.set(null); this.billForm.reset({ billNumber: '', vendorId: '', billDate: '', dueDate: '', amount: 0, gst: 0, paymentStatus: 'UNPAID', linkedPurchaseOrderId: '', linkedDocumentId: '', linkedFinancePayableId: '' }); }
  resetSubscriptionForm(): void { this.editingSubscriptionId.set(null); this.subscriptionForm.reset({ serviceName: '', vendorId: '', plan: '', billingCycle: 'MONTHLY', amount: 0, renewalDate: '', autoRenewalEnabled: false, owner: '', status: 'ACTIVE' }); }
  resetApprovalForm(): void { this.editingApprovalId.set(null); this.approvalForm.reset({ approvalTitle: '', approvalType: 'VENDOR_PAYMENT', status: 'PENDING_APPROVAL', approver: '', approvalNotes: '', approvalDate: '', rejectionReason: '', linkedRecordType: '', linkedRecordId: '' }); }
  resetVendorDocumentForm(): void { this.editingVendorDocumentId.set(null); this.vendorDocumentForm.reset({ vendorId: '', documentId: '', documentPurpose: '', status: 'ACTIVE' }); }

  archive(kind: ProcurementTab, id: string): void {
    if (!this.canArchive()) return;
    const request = this.archiveRequest(kind, id);
    if (!request) return;
    this.run(request, 'Procurement record archived.');
  }

  generateReport(): void {
    this.api.procurementReport(this.reportForm.getRawValue().reportType).subscribe({
      next: (report) => this.report.set(report),
      error: () => this.error.set('Procurement report could not be generated.')
    });
  }

  label(value: string | null | undefined): string { return value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'No information has been added yet.'; }
  currency(value: number | null | undefined): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  overdue(date: string | null | undefined): boolean { return Boolean(date) && new Date(date as string) < new Date(new Date().toDateString()); }
  vendorName(id: string | null | undefined): string { return this.vendors().find((vendor) => vendor.id === id)?.vendorName || 'No vendor selected'; }
  total(amount: number | null | undefined, gst: number | null | undefined): string { return this.currency(Number(amount ?? 0) + Number(gst ?? 0)); }
  print(): void { window.print(); }

  private archiveRequest(kind: ProcurementTab, id: string): Observable<void> | null {
    if (kind === 'vendors') return this.api.archiveProcurementVendor(id);
    if (kind === 'requests') return this.api.archivePurchaseRequest(id);
    if (kind === 'orders') return this.api.archivePurchaseOrder(id);
    if (kind === 'bills') return this.api.archiveVendorBill(id);
    if (kind === 'subscriptions') return this.api.archiveProcurementSubscription(id);
    if (kind === 'approvals') return this.api.archiveProcurementApproval(id);
    if (kind === 'documents') return this.api.archiveVendorDocument(id);
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
        this.error.set('Procurement record could not be saved.');
        this.saving.set(false);
      }
    });
  }

  private toNumber(value: number | string): number { return Number(value || 0); }

  private clean<T extends Record<string, unknown>>(payload: T): T {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === '' ? undefined : value])) as T;
  }
}