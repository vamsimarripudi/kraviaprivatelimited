import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ApiService } from '../core/http/api.service';
import { LeadPriority, LeadStage, SalesCustomerRecord, SalesCustomerRequest, SalesLeadRecord, SalesLeadRequest } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

type SalesView = 'leads' | 'customers';

const LEAD_STAGES: Array<{ value: LeadStage; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'DEMO_SCHEDULED', label: 'Demo Scheduled' },
  { value: 'DEMO_COMPLETED', label: 'Demo Completed' },
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'ARCHIVED', label: 'Archived' }
];

const PRIORITIES: Array<{ value: LeadPriority; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' }
];

@Component({
  selector: 'kravia-sales',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './sales.component.html'
})
export class SalesComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly stages = LEAD_STAGES;
  readonly priorities = PRIORITIES;
  readonly view = signal<SalesView>('leads');
  readonly leads = signal<SalesLeadRecord[]>([]);
  readonly customers = signal<SalesCustomerRecord[]>([]);
  readonly selectedLead = signal<SalesLeadRecord | null>(null);
  readonly selectedCustomer = signal<SalesCustomerRecord | null>(null);
  readonly leadEditingId = signal<string | null>(null);
  readonly customerEditingId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly leadQuery = signal('');
  readonly leadStage = signal<LeadStage | ''>('');
  readonly leadPriority = signal<LeadPriority | ''>('');
  readonly customerQuery = signal('');
  readonly customerProduct = signal('');
  readonly customerSubscription = signal('');

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly summaryCards = computed(() => {
    const leads = this.leads();
    const customers = this.customers();
    const activeStages = new Set<LeadStage>(['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PROPOSAL_SENT', 'NEGOTIATION']);
    return [
      { label: 'Total Leads', value: leads.filter((lead) => lead.stage !== 'ARCHIVED').length, tone: 'neutral' },
      { label: 'Active Opportunities', value: leads.filter((lead) => activeStages.has(lead.stage)).length, tone: 'positive' },
      { label: 'Demo Scheduled', value: leads.filter((lead) => lead.stage === 'DEMO_SCHEDULED').length, tone: 'neutral' },
      { label: 'Proposals Sent', value: leads.filter((lead) => lead.stage === 'PROPOSAL_SENT').length, tone: 'neutral' },
      { label: 'Won Customers', value: customers.filter((customer) => !customer.archivedAt).length, tone: 'positive' },
      { label: 'Lost Leads', value: leads.filter((lead) => lead.stage === 'LOST').length, tone: 'warning' },
      { label: 'Follow-ups Due', value: leads.filter((lead) => lead.followUpDue).length, tone: 'warning' }
    ];
  });

  readonly leadForm = this.fb.nonNullable.group({
    leadName: ['', [Validators.required, Validators.maxLength(255)]],
    organizationName: ['', [Validators.required, Validators.maxLength(255)]],
    contactPerson: ['', Validators.maxLength(255)],
    phone: ['', Validators.maxLength(80)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    productInterest: ['', [Validators.required, Validators.maxLength(255)]],
    leadSource: ['', Validators.maxLength(255)],
    stage: ['NEW' as LeadStage, Validators.required],
    priority: ['MEDIUM' as LeadPriority, Validators.required],
    assignedPerson: ['', Validators.maxLength(255)],
    lastContactedDate: [''],
    nextFollowUpDate: [''],
    notes: ['', Validators.maxLength(4000)]
  });

  readonly customerForm = this.fb.nonNullable.group({
    customerName: ['', [Validators.required, Validators.maxLength(255)]],
    organizationType: ['', Validators.maxLength(255)],
    product: ['', [Validators.required, Validators.maxLength(255)]],
    plan: ['', Validators.maxLength(255)],
    subscriptionStatus: ['', Validators.maxLength(255)],
    startDate: [''],
    renewalDate: [''],
    paymentStatus: ['', Validators.maxLength(255)],
    supportStatus: ['', Validators.maxLength(255)],
    onboardingStatus: ['', Validators.maxLength(255)],
    notes: ['', Validators.maxLength(4000)]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      leads: this.api.salesLeads({ query: this.leadQuery(), stage: this.leadStage(), priority: this.leadPriority() }),
      customers: this.api.salesCustomers({ query: this.customerQuery(), product: this.customerProduct(), subscriptionStatus: this.customerSubscription() })
    }).subscribe({
      next: ({ leads, customers }) => {
        this.leads.set(leads);
        this.customers.set(customers);
        this.selectedLead.set(leads.find((lead) => lead.id === this.selectedLead()?.id) ?? leads[0] ?? null);
        this.selectedCustomer.set(customers.find((customer) => customer.id === this.selectedCustomer()?.id) ?? customers[0] ?? null);
      },
      error: () => this.error.set('Unable to load sales pipeline records.'),
      complete: () => this.loading.set(false)
    });
  }

  setView(view: SalesView): void { this.view.set(view); }
  applyLeadSearch(value: string): void { this.leadQuery.set(value); this.load(); }
  applyLeadStage(value: string): void { this.leadStage.set(value as LeadStage | ''); this.load(); }
  applyLeadPriority(value: string): void { this.leadPriority.set(value as LeadPriority | ''); this.load(); }
  applyCustomerSearch(value: string): void { this.customerQuery.set(value); this.load(); }
  applyCustomerProduct(value: string): void { this.customerProduct.set(value); this.load(); }
  applyCustomerSubscription(value: string): void { this.customerSubscription.set(value); this.load(); }

  selectLead(lead: SalesLeadRecord): void {
    this.selectedLead.set(lead);
    if (this.leadEditingId() !== lead.id) this.leadEditingId.set(null);
  }

  selectCustomer(customer: SalesCustomerRecord): void {
    this.selectedCustomer.set(customer);
    if (this.customerEditingId() !== customer.id) this.customerEditingId.set(null);
  }

  startLeadEdit(lead: SalesLeadRecord): void {
    if (!this.canEdit() || lead.stage === 'ARCHIVED') return;
    this.selectLead(lead);
    this.leadEditingId.set(lead.id);
    this.leadForm.reset({
      leadName: lead.leadName,
      organizationName: lead.organizationName,
      contactPerson: lead.contactPerson ?? '',
      phone: lead.phone ?? '',
      email: lead.email ?? '',
      productInterest: lead.productInterest,
      leadSource: lead.leadSource ?? '',
      stage: lead.stage,
      priority: lead.priority,
      assignedPerson: lead.assignedPerson ?? '',
      lastContactedDate: lead.lastContactedDate ?? '',
      nextFollowUpDate: lead.nextFollowUpDate ?? '',
      notes: lead.notes ?? ''
    });
  }

  startCustomerEdit(customer: SalesCustomerRecord): void {
    if (!this.canEdit() || customer.archivedAt) return;
    this.selectCustomer(customer);
    this.customerEditingId.set(customer.id);
    this.customerForm.reset({
      customerName: customer.customerName,
      organizationType: customer.organizationType ?? '',
      product: customer.product,
      plan: customer.plan ?? '',
      subscriptionStatus: customer.subscriptionStatus ?? '',
      startDate: customer.startDate ?? '',
      renewalDate: customer.renewalDate ?? '',
      paymentStatus: customer.paymentStatus ?? '',
      supportStatus: customer.supportStatus ?? '',
      onboardingStatus: customer.onboardingStatus ?? '',
      notes: customer.notes ?? ''
    });
  }

  cancelLeadEdit(): void { this.leadEditingId.set(null); this.resetLeadForm(); }
  cancelCustomerEdit(): void { this.customerEditingId.set(null); this.resetCustomerForm(); }

  submitLead(): void {
    if (!this.canEdit()) return;
    if (this.leadForm.invalid) {
      this.leadForm.markAllAsTouched();
      return;
    }
    const payload = this.leadPayload();
    const editingId = this.leadEditingId();
    this.error.set('');
    this.success.set('');
    const request = editingId ? this.api.updateSalesLead(editingId, payload) : this.api.createSalesLead(payload);
    request.subscribe({
      next: (lead) => {
        this.selectedLead.set(lead);
        this.leadEditingId.set(null);
        this.resetLeadForm();
        this.success.set(editingId ? 'Lead saved.' : 'Lead created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Lead could not be saved.' : 'Lead could not be created.')
    });
  }

  submitCustomer(): void {
    if (!this.canEdit()) return;
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }
    const payload = this.customerPayload();
    const editingId = this.customerEditingId();
    this.error.set('');
    this.success.set('');
    const request = editingId ? this.api.updateSalesCustomer(editingId, payload) : this.api.createSalesCustomer(payload);
    request.subscribe({
      next: (customer) => {
        this.selectedCustomer.set(customer);
        this.customerEditingId.set(null);
        this.resetCustomerForm();
        this.success.set(editingId ? 'Customer saved.' : 'Customer created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Customer could not be saved.' : 'Customer could not be created.')
    });
  }

  archiveLead(lead: SalesLeadRecord): void {
    if (!this.canArchive() || lead.stage === 'ARCHIVED') return;
    this.api.archiveSalesLead(lead.id).subscribe({
      next: () => { this.success.set('Lead archived.'); this.load(); },
      error: () => this.error.set('Lead could not be archived.')
    });
  }

  archiveCustomer(customer: SalesCustomerRecord): void {
    if (!this.canArchive() || customer.archivedAt) return;
    this.api.archiveSalesCustomer(customer.id).subscribe({
      next: () => { this.success.set('Customer archived.'); this.load(); },
      error: () => this.error.set('Customer could not be archived.')
    });
  }

  stageLabel(value: LeadStage): string { return this.stages.find((stage) => stage.value === value)?.label ?? value; }
  priorityLabel(value: LeadPriority): string { return this.priorities.find((priority) => priority.value === value)?.label ?? value; }
  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }
  formatDate(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : 'No information has been added yet.'; }

  private leadPayload(): SalesLeadRequest {
    const values = this.leadForm.getRawValue();
    return {
      leadName: values.leadName.trim(),
      organizationName: values.organizationName.trim(),
      contactPerson: values.contactPerson.trim() || undefined,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      productInterest: values.productInterest.trim(),
      leadSource: values.leadSource.trim() || undefined,
      stage: values.stage,
      priority: values.priority,
      assignedPerson: values.assignedPerson.trim() || undefined,
      lastContactedDate: values.lastContactedDate || undefined,
      nextFollowUpDate: values.nextFollowUpDate || undefined,
      notes: values.notes.trim() || undefined
    };
  }

  private customerPayload(): SalesCustomerRequest {
    const values = this.customerForm.getRawValue();
    return {
      customerName: values.customerName.trim(),
      organizationType: values.organizationType.trim() || undefined,
      product: values.product.trim(),
      plan: values.plan.trim() || undefined,
      subscriptionStatus: values.subscriptionStatus.trim() || undefined,
      startDate: values.startDate || undefined,
      renewalDate: values.renewalDate || undefined,
      paymentStatus: values.paymentStatus.trim() || undefined,
      supportStatus: values.supportStatus.trim() || undefined,
      onboardingStatus: values.onboardingStatus.trim() || undefined,
      notes: values.notes.trim() || undefined
    };
  }

  private resetLeadForm(): void {
    this.leadForm.reset({
      leadName: '',
      organizationName: '',
      contactPerson: '',
      phone: '',
      email: '',
      productInterest: '',
      leadSource: '',
      stage: 'NEW',
      priority: 'MEDIUM',
      assignedPerson: '',
      lastContactedDate: '',
      nextFollowUpDate: '',
      notes: ''
    });
  }

  private resetCustomerForm(): void {
    this.customerForm.reset({
      customerName: '',
      organizationType: '',
      product: '',
      plan: '',
      subscriptionStatus: '',
      startDate: '',
      renewalDate: '',
      paymentStatus: '',
      supportStatus: '',
      onboardingStatus: '',
      notes: ''
    });
  }
}
