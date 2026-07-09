import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ApiService } from '../core/http/api.service';
import {
  ContractType,
  LegalApprovalRecord,
  LegalContractRecord,
  LegalNoticeRecord,
  LegalObligationRecord,
  LegalPriority,
  LegalReport,
  LegalReportType,
  LegalRiskRecord,
  LegalRiskSeverity,
  LegalStatus,
  LegalSummary,
  SignatureStatus
} from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

type LegalTab = 'dashboard' | 'contracts' | 'obligations' | 'approvals' | 'notices' | 'risks' | 'reports';

@Component({
  selector: 'kravia-legal',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './legal.component.html'
})
export class LegalComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly tabs: Array<{ value: LegalTab; label: string }> = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'contracts', label: 'Contracts' },
    { value: 'obligations', label: 'Obligations' },
    { value: 'approvals', label: 'Approvals' },
    { value: 'notices', label: 'Notices' },
    { value: 'risks', label: 'Risks' },
    { value: 'reports', label: 'Reports' }
  ];
  readonly contractTypes: ContractType[] = ['FOUNDER_AGREEMENT', 'CO_FOUNDER_AGREEMENT', 'SHAREHOLDER_AGREEMENT', 'VENDOR_AGREEMENT', 'CUSTOMER_AGREEMENT', 'NDA', 'EMPLOYMENT_AGREEMENT', 'CONSULTANT_AGREEMENT', 'RENT_AGREEMENT', 'BANK_AGREEMENT', 'SERVICE_AGREEMENT', 'OTHER'];
  readonly legalStatuses: LegalStatus[] = ['DRAFT', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'APPROVED', 'SIGNED', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'ARCHIVED'];
  readonly signatureStatuses: SignatureStatus[] = ['NOT_REQUIRED', 'PENDING_SIGNATURE', 'PARTIALLY_SIGNED', 'SIGNED', 'DECLINED', 'EXPIRED'];
  readonly priorities: LegalPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  readonly riskSeverities: LegalRiskSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  readonly reportTypes: LegalReportType[] = ['CONTRACT_SUMMARY', 'OBLIGATION_SUMMARY', 'RENEWAL_TRACKER', 'APPROVAL_SUMMARY', 'NOTICE_SUMMARY', 'RISK_SUMMARY'];

  readonly activeTab = signal<LegalTab>('dashboard');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly summary = signal<LegalSummary | null>(null);
  readonly contracts = signal<LegalContractRecord[]>([]);
  readonly obligations = signal<LegalObligationRecord[]>([]);
  readonly approvals = signal<LegalApprovalRecord[]>([]);
  readonly notices = signal<LegalNoticeRecord[]>([]);
  readonly risks = signal<LegalRiskRecord[]>([]);
  readonly report = signal<LegalReport | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));

  readonly editingContractId = signal<string | null>(null);
  readonly editingObligationId = signal<string | null>(null);
  readonly editingApprovalId = signal<string | null>(null);
  readonly editingNoticeId = signal<string | null>(null);
  readonly editingRiskId = signal<string | null>(null);

  readonly contractFilterForm = this.fb.nonNullable.group({ query: [''], type: ['' as ContractType | ''], status: ['' as LegalStatus | ''] });
  readonly obligationFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as LegalStatus | ''], priority: ['' as LegalPriority | ''] });
  readonly statusFilterForm = this.fb.nonNullable.group({ query: [''], status: ['' as LegalStatus | ''] });
  readonly riskFilterForm = this.fb.nonNullable.group({ query: [''], severity: ['' as LegalRiskSeverity | ''], status: ['' as LegalStatus | ''] });

  readonly contractForm = this.fb.nonNullable.group({
    contractTitle: ['', Validators.required],
    contractType: ['OTHER' as ContractType, Validators.required],
    partiesInvolved: [''],
    effectiveDate: [''],
    expiryDate: [''],
    renewalDate: [''],
    contractValue: [0, [Validators.min(0)]],
    status: ['DRAFT' as LegalStatus, Validators.required],
    approvalStatus: ['DRAFT' as LegalStatus, Validators.required],
    signatureStatus: ['PENDING_SIGNATURE' as SignatureStatus, Validators.required],
    relatedDocumentId: [''],
    responsiblePerson: [''],
    notes: ['']
  });
  readonly obligationForm = this.fb.nonNullable.group({ contractId: [''], obligationTitle: ['', Validators.required], description: [''], responsiblePerson: ['', Validators.required], dueDate: [''], status: ['DRAFT' as LegalStatus, Validators.required], priority: ['MEDIUM' as LegalPriority, Validators.required], relatedDocumentId: [''], notes: [''] });
  readonly approvalForm = this.fb.nonNullable.group({ contractId: [''], approvalTitle: ['', Validators.required], approvalStatus: ['PENDING_APPROVAL' as LegalStatus, Validators.required], approver: [''], approvalNotes: [''], approvalDate: [''], rejectionReason: [''], relatedDocumentId: [''], notes: [''] });
  readonly noticeForm = this.fb.nonNullable.group({ noticeTitle: ['', Validators.required], noticeType: [''], issuedBy: [''], issuedTo: ['', Validators.required], noticeDate: ['', Validators.required], responseDueDate: [''], status: ['UNDER_REVIEW' as LegalStatus, Validators.required], relatedDocumentId: [''], responsiblePerson: [''], notes: [''] });
  readonly riskForm = this.fb.nonNullable.group({ contractId: [''], riskRegisterEntryId: [''], riskTitle: ['', Validators.required], severity: ['MEDIUM' as LegalRiskSeverity, Validators.required], status: ['UNDER_REVIEW' as LegalStatus, Validators.required], owner: [''], mitigationPlan: [''], reviewDate: [''], notes: [''] });
  readonly reportForm = this.fb.nonNullable.group({ reportType: ['CONTRACT_SUMMARY' as LegalReportType, Validators.required] });

  constructor() { this.load(); }

  setTab(tab: LegalTab): void { this.activeTab.set(tab); this.error.set(''); this.success.set(''); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.legalSummary(),
      contracts: this.api.legalContracts(this.contractFilterForm.getRawValue()),
      obligations: this.api.legalObligations(this.obligationFilterForm.getRawValue()),
      approvals: this.api.legalApprovals(this.statusFilterForm.getRawValue()),
      notices: this.api.legalNotices(this.statusFilterForm.getRawValue()),
      risks: this.api.legalRisks(this.riskFilterForm.getRawValue())
    }).subscribe({
      next: (result) => {
        this.summary.set(result.summary);
        this.contracts.set(result.contracts);
        this.obligations.set(result.obligations);
        this.approvals.set(result.approvals);
        this.notices.set(result.notices);
        this.risks.set(result.risks);
        this.loading.set(false);
      },
      error: () => { this.error.set('Legal records could not be loaded.'); this.loading.set(false); }
    });
  }

  saveContract(): void { if (this.contractForm.invalid) return; const value = this.contractForm.getRawValue(); const payload = { ...this.clean(value), contractValue: Number(value.contractValue || 0) }; const id = this.editingContractId(); this.run(id ? this.api.updateLegalContract(id, payload) : this.api.createLegalContract(payload), id ? 'Contract updated.' : 'Contract created.', () => this.resetContractForm()); }
  saveObligation(): void { if (this.obligationForm.invalid) return; const id = this.editingObligationId(); this.run(id ? this.api.updateLegalObligation(id, this.clean(this.obligationForm.getRawValue())) : this.api.createLegalObligation(this.clean(this.obligationForm.getRawValue())), id ? 'Obligation updated.' : 'Obligation created.', () => this.resetObligationForm()); }
  saveApproval(): void { if (this.approvalForm.invalid) return; const id = this.editingApprovalId(); this.run(id ? this.api.updateLegalApproval(id, this.clean(this.approvalForm.getRawValue())) : this.api.createLegalApproval(this.clean(this.approvalForm.getRawValue())), id ? 'Approval updated.' : 'Approval created.', () => this.resetApprovalForm()); }
  saveNotice(): void { if (this.noticeForm.invalid) return; const id = this.editingNoticeId(); this.run(id ? this.api.updateLegalNotice(id, this.clean(this.noticeForm.getRawValue())) : this.api.createLegalNotice(this.clean(this.noticeForm.getRawValue())), id ? 'Notice updated.' : 'Notice created.', () => this.resetNoticeForm()); }
  saveRisk(): void { if (this.riskForm.invalid) return; const id = this.editingRiskId(); this.run(id ? this.api.updateLegalRisk(id, this.clean(this.riskForm.getRawValue())) : this.api.createLegalRisk(this.clean(this.riskForm.getRawValue())), id ? 'Risk updated.' : 'Risk created.', () => this.resetRiskForm()); }

  editContract(item: LegalContractRecord): void { if (!this.canEdit()) return; this.editingContractId.set(item.id); this.contractForm.reset({ contractTitle: item.contractTitle, contractType: item.contractType, partiesInvolved: item.partiesInvolved || '', effectiveDate: item.effectiveDate || '', expiryDate: item.expiryDate || '', renewalDate: item.renewalDate || '', contractValue: item.contractValue || 0, status: item.status, approvalStatus: item.approvalStatus, signatureStatus: item.signatureStatus, relatedDocumentId: item.relatedDocumentId || '', responsiblePerson: item.responsiblePerson || '', notes: item.notes || '' }); }
  editObligation(item: LegalObligationRecord): void { if (!this.canEdit()) return; this.editingObligationId.set(item.id); this.obligationForm.reset({ contractId: item.contractId || '', obligationTitle: item.obligationTitle, description: item.description || '', responsiblePerson: item.responsiblePerson, dueDate: item.dueDate || '', status: item.status, priority: item.priority, relatedDocumentId: item.relatedDocumentId || '', notes: item.notes || '' }); }
  editApproval(item: LegalApprovalRecord): void { if (!this.canEdit()) return; this.editingApprovalId.set(item.id); this.approvalForm.reset({ contractId: item.contractId || '', approvalTitle: item.approvalTitle, approvalStatus: item.approvalStatus, approver: item.approver || '', approvalNotes: item.approvalNotes || '', approvalDate: item.approvalDate || '', rejectionReason: item.rejectionReason || '', relatedDocumentId: item.relatedDocumentId || '', notes: item.notes || '' }); }
  editNotice(item: LegalNoticeRecord): void { if (!this.canEdit()) return; this.editingNoticeId.set(item.id); this.noticeForm.reset({ noticeTitle: item.noticeTitle, noticeType: item.noticeType || '', issuedBy: item.issuedBy || '', issuedTo: item.issuedTo, noticeDate: item.noticeDate, responseDueDate: item.responseDueDate || '', status: item.status, relatedDocumentId: item.relatedDocumentId || '', responsiblePerson: item.responsiblePerson || '', notes: item.notes || '' }); }
  editRisk(item: LegalRiskRecord): void { if (!this.canEdit()) return; this.editingRiskId.set(item.id); this.riskForm.reset({ contractId: item.contractId || '', riskRegisterEntryId: item.riskRegisterEntryId || '', riskTitle: item.riskTitle, severity: item.severity, status: item.status, owner: item.owner || '', mitigationPlan: item.mitigationPlan || '', reviewDate: item.reviewDate || '', notes: item.notes || '' }); }

  archive(kind: LegalTab, id: string): void {
    if (!this.canArchive()) return;
    const request = this.archiveRequest(kind, id);
    if (request) this.run(request, 'Legal record archived.');
  }

  generateReport(): void {
    this.api.legalReport(this.reportForm.getRawValue().reportType).subscribe({
      next: (report) => this.report.set(report),
      error: () => this.error.set('Legal report could not be generated.')
    });
  }

  resetContractForm(): void { this.editingContractId.set(null); this.contractForm.reset({ contractTitle: '', contractType: 'OTHER', partiesInvolved: '', effectiveDate: '', expiryDate: '', renewalDate: '', contractValue: 0, status: 'DRAFT', approvalStatus: 'DRAFT', signatureStatus: 'PENDING_SIGNATURE', relatedDocumentId: '', responsiblePerson: '', notes: '' }); }
  resetObligationForm(): void { this.editingObligationId.set(null); this.obligationForm.reset({ contractId: '', obligationTitle: '', description: '', responsiblePerson: '', dueDate: '', status: 'DRAFT', priority: 'MEDIUM', relatedDocumentId: '', notes: '' }); }
  resetApprovalForm(): void { this.editingApprovalId.set(null); this.approvalForm.reset({ contractId: '', approvalTitle: '', approvalStatus: 'PENDING_APPROVAL', approver: '', approvalNotes: '', approvalDate: '', rejectionReason: '', relatedDocumentId: '', notes: '' }); }
  resetNoticeForm(): void { this.editingNoticeId.set(null); this.noticeForm.reset({ noticeTitle: '', noticeType: '', issuedBy: '', issuedTo: '', noticeDate: '', responseDueDate: '', status: 'UNDER_REVIEW', relatedDocumentId: '', responsiblePerson: '', notes: '' }); }
  resetRiskForm(): void { this.editingRiskId.set(null); this.riskForm.reset({ contractId: '', riskRegisterEntryId: '', riskTitle: '', severity: 'MEDIUM', status: 'UNDER_REVIEW', owner: '', mitigationPlan: '', reviewDate: '', notes: '' }); }

  label(value: string | null | undefined): string { return value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'No information has been added yet.'; }
  contractTitle(id: string | null | undefined): string { return this.contracts().find((contract) => contract.id === id)?.contractTitle || 'No contract selected'; }
  currency(value: number | null | undefined): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  upcoming(date: string | null | undefined): boolean { if (!date) return false; const today = new Date(new Date().toDateString()); const target = new Date(date); const next = new Date(today); next.setDate(today.getDate() + 30); return target >= today && target <= next; }
  print(): void { window.print(); }

  private archiveRequest(kind: LegalTab, id: string): Observable<void> | null {
    if (kind === 'contracts') return this.api.archiveLegalContract(id);
    if (kind === 'obligations') return this.api.archiveLegalObligation(id);
    if (kind === 'approvals') return this.api.archiveLegalApproval(id);
    if (kind === 'notices') return this.api.archiveLegalNotice(id);
    if (kind === 'risks') return this.api.archiveLegalRisk(id);
    return null;
  }

  private run<T>(request: Observable<T>, message: string, afterSuccess?: () => void): void {
    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: () => { this.success.set(message); this.saving.set(false); afterSuccess?.(); this.load(); },
      error: () => { this.error.set('Legal record could not be saved.'); this.saving.set(false); }
    });
  }

  private clean<T extends Record<string, unknown>>(payload: T): T {
    return Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, value === '' ? undefined : value])) as T;
  }
}
