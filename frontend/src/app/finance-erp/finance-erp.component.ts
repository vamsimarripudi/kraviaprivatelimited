import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { BankAccountRecord, BankTransactionRecord, BudgetRecord, BudgetStatus, FinanceAccountRecord, FinanceAccountType, FinanceErpReport, FinanceErpSummary, FinanceRecordStatus, FinanceReportType, FinancialApprovalRecord, FinancialApprovalStatus, GstFilingStatus, GstRecordErp, InvoiceRecord, InvoiceStatus, JournalApprovalStatus, JournalEntryRecord, PayableRecord, PaymentStatus, ReceivableRecord, ReceivableStatus, ReconciliationStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

type FinanceErpTab = 'dashboard' | 'accounts' | 'ledger' | 'banking' | 'receivables' | 'payables' | 'gst' | 'budgets' | 'approvals' | 'reports';

const ACCOUNT_TYPES: Array<{ value: FinanceAccountType; label: string }> = [
  { value: 'ASSETS', label: 'Assets' },
  { value: 'LIABILITIES', label: 'Liabilities' },
  { value: 'EQUITY', label: 'Equity' },
  { value: 'INCOME', label: 'Income' },
  { value: 'EXPENSES', label: 'Expenses' },
  { value: 'OTHER_INCOME', label: 'Other Income' },
  { value: 'OTHER_EXPENSES', label: 'Other Expenses' }
];

const RECORD_STATUSES: FinanceRecordStatus[] = ['ACTIVE', 'INACTIVE', 'ARCHIVED'];
const JOURNAL_STATUSES: JournalApprovalStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REJECTED', 'ARCHIVED'];
const RECONCILIATION_STATUSES: ReconciliationStatus[] = ['UNRECONCILED', 'RECONCILED', 'REVIEW_REQUIRED', 'ARCHIVED'];
const INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'ARCHIVED'];
const RECEIVABLE_STATUSES: ReceivableStatus[] = ['OPEN', 'PARTIAL', 'RECEIVED', 'OVERDUE', 'WRITTEN_OFF', 'ARCHIVED'];
const PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'SCHEDULED', 'PAID', 'OVERDUE', 'CANCELLED', 'ARCHIVED'];
const GST_STATUSES: GstFilingStatus[] = ['DRAFT', 'READY', 'FILED', 'OVERDUE', 'NOT_APPLICABLE', 'ARCHIVED'];
const BUDGET_STATUSES: BudgetStatus[] = ['DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED'];
const APPROVAL_STATUSES: FinancialApprovalStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'ARCHIVED'];
const REPORT_TYPES: FinanceReportType[] = ['TRIAL_BALANCE', 'BALANCE_SHEET', 'PROFIT_LOSS', 'CASH_FLOW', 'GST_SUMMARY', 'RECEIVABLES_AGING', 'PAYABLES_AGING', 'BUDGET_VARIANCE', 'BANK_RECONCILIATION_SUMMARY'];

@Component({
  selector: 'kravia-finance-erp',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './finance-erp.component.html'
})
export class FinanceErpComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly tabs: Array<{ value: FinanceErpTab; label: string }> = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'accounts', label: 'Chart of Accounts' },
    { value: 'ledger', label: 'General Ledger' },
    { value: 'banking', label: 'Banking' },
    { value: 'receivables', label: 'Receivables' },
    { value: 'payables', label: 'Payables' },
    { value: 'gst', label: 'GST' },
    { value: 'budgets', label: 'Budgets' },
    { value: 'approvals', label: 'Approvals' },
    { value: 'reports', label: 'Reports' }
  ];
  readonly accountTypes = ACCOUNT_TYPES;
  readonly recordStatuses = RECORD_STATUSES;
  readonly journalStatuses = JOURNAL_STATUSES;
  readonly reconciliationStatuses = RECONCILIATION_STATUSES;
  readonly invoiceStatuses = INVOICE_STATUSES;
  readonly receivableStatuses = RECEIVABLE_STATUSES;
  readonly paymentStatuses = PAYMENT_STATUSES;
  readonly gstStatuses = GST_STATUSES;
  readonly budgetStatuses = BUDGET_STATUSES;
  readonly approvalStatuses = APPROVAL_STATUSES;
  readonly reportTypes = REPORT_TYPES;

  readonly activeTab = signal<FinanceErpTab>('dashboard');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly summary = signal<FinanceErpSummary | null>(null);
  readonly accounts = signal<FinanceAccountRecord[]>([]);
  readonly journals = signal<JournalEntryRecord[]>([]);
  readonly bankAccounts = signal<BankAccountRecord[]>([]);
  readonly bankTransactions = signal<BankTransactionRecord[]>([]);
  readonly invoices = signal<InvoiceRecord[]>([]);
  readonly receivables = signal<ReceivableRecord[]>([]);
  readonly payables = signal<PayableRecord[]>([]);
  readonly gstRecords = signal<GstRecordErp[]>([]);
  readonly budgets = signal<BudgetRecord[]>([]);
  readonly approvals = signal<FinancialApprovalRecord[]>([]);
  readonly report = signal<FinanceErpReport | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));

  readonly accountForm = this.fb.nonNullable.group({
    accountCode: ['', Validators.required],
    accountName: ['', Validators.required],
    accountType: ['ASSETS' as FinanceAccountType, Validators.required],
    parentAccountId: [''],
    status: ['ACTIVE' as FinanceRecordStatus, Validators.required]
  });

  readonly journalForm = this.fb.nonNullable.group({
    voucherNumber: ['', Validators.required],
    postingDate: ['', Validators.required],
    narration: ['', Validators.required],
    approvalStatus: ['DRAFT' as JournalApprovalStatus, Validators.required],
    linkedDocumentId: [''],
    debitAccountId: ['', Validators.required],
    debit: [0, [Validators.required, Validators.min(0)]],
    creditAccountId: ['', Validators.required],
    credit: [0, [Validators.required, Validators.min(0)]]
  });

  readonly bankAccountForm = this.fb.nonNullable.group({
    bankName: ['', Validators.required],
    accountName: ['', Validators.required],
    accountNumberMasked: ['', Validators.required],
    ifscCode: [''],
    branch: [''],
    currentBalance: [0, Validators.min(0)],
    status: ['ACTIVE' as FinanceRecordStatus, Validators.required]
  });

  readonly bankTransactionForm = this.fb.nonNullable.group({
    bankAccountId: ['', Validators.required],
    transactionDate: ['', Validators.required],
    description: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    transactionType: ['DEBIT' as 'DEBIT' | 'CREDIT', Validators.required],
    reconciliationStatus: ['UNRECONCILED' as ReconciliationStatus, Validators.required],
    linkedJournalEntryId: ['']
  });

  readonly invoiceForm = this.fb.nonNullable.group({
    invoiceNumber: ['', Validators.required],
    customerName: ['', Validators.required],
    invoiceDate: ['', Validators.required],
    dueDate: ['', Validators.required],
    totalAmount: [0, [Validators.required, Validators.min(0)]],
    outstandingAmount: [0, [Validators.required, Validators.min(0)]],
    status: ['DRAFT' as InvoiceStatus, Validators.required]
  });

  readonly receivableForm = this.fb.nonNullable.group({
    customerName: ['', Validators.required],
    invoiceId: [''],
    dueDate: ['', Validators.required],
    outstandingAmount: [0, [Validators.required, Validators.min(0)]],
    status: ['OPEN' as ReceivableStatus, Validators.required],
    reminderStatus: ['']
  });

  readonly payableForm = this.fb.nonNullable.group({
    vendorName: ['', Validators.required],
    billNumber: ['', Validators.required],
    dueDate: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    paymentStatus: ['PENDING' as PaymentStatus, Validators.required]
  });

  readonly gstForm = this.fb.nonNullable.group({
    filingPeriod: ['', Validators.required],
    gstCollected: [0, Validators.min(0)],
    gstPaid: [0, Validators.min(0)],
    inputTaxCredit: [0, Validators.min(0)],
    outputTax: [0, Validators.min(0)],
    filingStatus: ['DRAFT' as GstFilingStatus, Validators.required]
  });

  readonly budgetForm = this.fb.nonNullable.group({
    budgetName: ['', Validators.required],
    budgetType: ['ANNUAL' as 'ANNUAL' | 'DEPARTMENT' | 'PRODUCT', Validators.required],
    financialYear: ['', Validators.required],
    department: [''],
    product: [''],
    annualBudget: [0, Validators.min(0)],
    status: ['DRAFT' as BudgetStatus, Validators.required],
    lineName: [''],
    lineAccountId: [''],
    plannedAmount: [0, Validators.min(0)],
    actualAmount: [0, Validators.min(0)]
  });

  readonly approvalForm = this.fb.nonNullable.group({
    approvalType: ['LARGE_EXPENSE' as 'LARGE_EXPENSE' | 'VENDOR_PAYMENT' | 'BUDGET_CHANGE' | 'JOURNAL_ENTRY', Validators.required],
    title: ['', Validators.required],
    amount: [0, Validators.min(0)],
    status: ['DRAFT' as FinancialApprovalStatus, Validators.required],
    approver: [''],
    approvalNotes: [''],
    approvalDate: [''],
    linkedRecordType: [''],
    linkedRecordId: [''],
    rejectionReason: ['']
  });

  readonly reportForm = this.fb.nonNullable.group({
    reportType: ['TRIAL_BALANCE' as FinanceReportType, Validators.required]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.financeErpSummary(),
      accounts: this.api.financeAccounts({}),
      journals: this.api.journalEntries({}),
      bankAccounts: this.api.financeBankAccounts({}),
      bankTransactions: this.api.bankTransactions({}),
      invoices: this.api.invoices({}),
      receivables: this.api.receivables({}),
      payables: this.api.payables({}),
      gstRecords: this.api.gstRecords({}),
      budgets: this.api.budgets({}),
      approvals: this.api.financialApprovals({})
    }).subscribe({
      next: (data) => {
        this.summary.set(data.summary);
        this.accounts.set(data.accounts);
        this.journals.set(data.journals);
        this.bankAccounts.set(data.bankAccounts);
        this.bankTransactions.set(data.bankTransactions);
        this.invoices.set(data.invoices);
        this.receivables.set(data.receivables);
        this.payables.set(data.payables);
        this.gstRecords.set(data.gstRecords);
        this.budgets.set(data.budgets);
        this.approvals.set(data.approvals);
      },
      error: () => this.error.set('Unable to load finance ERP records.'),
      complete: () => this.loading.set(false)
    });
  }

  setTab(tab: FinanceErpTab): void {
    this.activeTab.set(tab);
    this.error.set('');
    this.success.set('');
  }

  createAccount(): void {
    if (!this.canEdit() || this.accountForm.invalid) return this.accountForm.markAllAsTouched();
    const value = this.accountForm.getRawValue();
    this.run(this.api.createFinanceAccount({ ...value, parentAccountId: value.parentAccountId || undefined }), 'Account created.', () => this.accountForm.reset({ accountCode: '', accountName: '', accountType: 'ASSETS', parentAccountId: '', status: 'ACTIVE' }));
  }

  createJournal(): void {
    if (!this.canEdit() || this.journalForm.invalid) return this.journalForm.markAllAsTouched();
    const value = this.journalForm.getRawValue();
    this.run(this.api.createJournalEntry({
      voucherNumber: value.voucherNumber,
      postingDate: value.postingDate,
      narration: value.narration,
      approvalStatus: value.approvalStatus,
      linkedDocumentId: value.linkedDocumentId || undefined,
      lines: [
        { accountId: value.debitAccountId, debit: this.toNumber(value.debit), credit: 0 },
        { accountId: value.creditAccountId, debit: 0, credit: this.toNumber(value.credit) }
      ]
    }), 'Journal entry created.', () => this.journalForm.reset({ voucherNumber: '', postingDate: '', narration: '', approvalStatus: 'DRAFT', linkedDocumentId: '', debitAccountId: '', debit: 0, creditAccountId: '', credit: 0 }));
  }

  createBankAccount(): void {
    if (!this.canEdit() || this.bankAccountForm.invalid) return this.bankAccountForm.markAllAsTouched();
    const value = this.bankAccountForm.getRawValue();
    this.run(this.api.createFinanceBankAccount({ ...value, ifscCode: value.ifscCode || undefined, branch: value.branch || undefined, currentBalance: this.toNumber(value.currentBalance) }), 'Bank account created.', () => this.bankAccountForm.reset({ bankName: '', accountName: '', accountNumberMasked: '', ifscCode: '', branch: '', currentBalance: 0, status: 'ACTIVE' }));
  }

  createBankTransaction(): void {
    if (!this.canEdit() || this.bankTransactionForm.invalid) return this.bankTransactionForm.markAllAsTouched();
    const value = this.bankTransactionForm.getRawValue();
    this.run(this.api.createBankTransaction({ ...value, amount: this.toNumber(value.amount), linkedJournalEntryId: value.linkedJournalEntryId || undefined }), 'Bank transaction recorded.', () => this.bankTransactionForm.reset({ bankAccountId: '', transactionDate: '', description: '', amount: 0, transactionType: 'DEBIT', reconciliationStatus: 'UNRECONCILED', linkedJournalEntryId: '' }));
  }

  createInvoice(): void {
    if (!this.canEdit() || this.invoiceForm.invalid) return this.invoiceForm.markAllAsTouched();
    const value = this.invoiceForm.getRawValue();
    this.run(this.api.createInvoice({ ...value, totalAmount: this.toNumber(value.totalAmount), outstandingAmount: this.toNumber(value.outstandingAmount) }), 'Invoice created.', () => this.invoiceForm.reset({ invoiceNumber: '', customerName: '', invoiceDate: '', dueDate: '', totalAmount: 0, outstandingAmount: 0, status: 'DRAFT' }));
  }

  createReceivable(): void {
    if (!this.canEdit() || this.receivableForm.invalid) return this.receivableForm.markAllAsTouched();
    const value = this.receivableForm.getRawValue();
    this.run(this.api.createReceivable({ ...value, invoiceId: value.invoiceId || undefined, outstandingAmount: this.toNumber(value.outstandingAmount), reminderStatus: value.reminderStatus || undefined }), 'Receivable created.', () => this.receivableForm.reset({ customerName: '', invoiceId: '', dueDate: '', outstandingAmount: 0, status: 'OPEN', reminderStatus: '' }));
  }

  createPayable(): void {
    if (!this.canEdit() || this.payableForm.invalid) return this.payableForm.markAllAsTouched();
    const value = this.payableForm.getRawValue();
    this.run(this.api.createPayable({ ...value, amount: this.toNumber(value.amount) }), 'Payable created.', () => this.payableForm.reset({ vendorName: '', billNumber: '', dueDate: '', amount: 0, paymentStatus: 'PENDING' }));
  }

  createGstRecord(): void {
    if (!this.canEdit() || this.gstForm.invalid) return this.gstForm.markAllAsTouched();
    const value = this.gstForm.getRawValue();
    this.run(this.api.createGstRecord({ ...value, gstCollected: this.toNumber(value.gstCollected), gstPaid: this.toNumber(value.gstPaid), inputTaxCredit: this.toNumber(value.inputTaxCredit), outputTax: this.toNumber(value.outputTax) }), 'GST record created.', () => this.gstForm.reset({ filingPeriod: '', gstCollected: 0, gstPaid: 0, inputTaxCredit: 0, outputTax: 0, filingStatus: 'DRAFT' }));
  }

  createBudget(): void {
    if (!this.canEdit() || this.budgetForm.invalid) return this.budgetForm.markAllAsTouched();
    const value = this.budgetForm.getRawValue();
    const lines = value.lineName ? [{ lineName: value.lineName, accountId: value.lineAccountId || undefined, plannedAmount: this.toNumber(value.plannedAmount), actualAmount: this.toNumber(value.actualAmount) }] : [];
    this.run(this.api.createBudget({ budgetName: value.budgetName, budgetType: value.budgetType, financialYear: value.financialYear, department: value.department || undefined, product: value.product || undefined, annualBudget: this.toNumber(value.annualBudget), status: value.status, lines }), 'Budget created.', () => this.budgetForm.reset({ budgetName: '', budgetType: 'ANNUAL', financialYear: '', department: '', product: '', annualBudget: 0, status: 'DRAFT', lineName: '', lineAccountId: '', plannedAmount: 0, actualAmount: 0 }));
  }

  createApproval(): void {
    if (!this.canEdit() || this.approvalForm.invalid) return this.approvalForm.markAllAsTouched();
    const value = this.approvalForm.getRawValue();
    this.run(this.api.createFinancialApproval({ ...value, amount: this.toNumber(value.amount), approver: value.approver || undefined, approvalNotes: value.approvalNotes || undefined, approvalDate: value.approvalDate || undefined, linkedRecordType: value.linkedRecordType || undefined, linkedRecordId: value.linkedRecordId || undefined, rejectionReason: value.rejectionReason || undefined }), 'Approval request created.', () => this.approvalForm.reset({ approvalType: 'LARGE_EXPENSE', title: '', amount: 0, status: 'DRAFT', approver: '', approvalNotes: '', approvalDate: '', linkedRecordType: '', linkedRecordId: '', rejectionReason: '' }));
  }

  archive(kind: string, id: string): void {
    if (!this.canArchive()) return;
    const request = this.archiveRequest(kind, id);
    if (!request) return;
    this.run(request, 'Record archived.');
  }

  generateReport(): void {
    this.api.financeErpReport(this.reportForm.getRawValue().reportType).subscribe({
      next: (report) => this.report.set(report),
      error: () => this.error.set('Report could not be generated.')
    });
  }

  label(value: string): string { return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()); }
  currency(value: number | null | undefined): string { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0)); }
  overdue(date: string): boolean { return Boolean(date) && new Date(date) < new Date(new Date().toDateString()); }

  private archiveRequest(kind: string, id: string): Observable<void> | null {
    if (kind === 'account') return this.api.archiveFinanceAccount(id);
    if (kind === 'journal') return this.api.archiveJournalEntry(id);
    if (kind === 'bankAccount') return this.api.archiveFinanceBankAccount(id);
    if (kind === 'bankTransaction') return this.api.archiveBankTransaction(id);
    if (kind === 'invoice') return this.api.archiveInvoice(id);
    if (kind === 'receivable') return this.api.archiveReceivable(id);
    if (kind === 'payable') return this.api.archivePayable(id);
    if (kind === 'gst') return this.api.archiveGstRecord(id);
    if (kind === 'budget') return this.api.archiveBudget(id);
    if (kind === 'approval') return this.api.archiveFinancialApproval(id);
    return null;
  }

  private run<T>(request: Observable<T>, message: string, afterSuccess?: () => void): void {
    this.error.set('');
    this.success.set('');
    request.subscribe({
      next: () => {
        this.success.set(message);
        afterSuccess?.();
        this.load();
      },
      error: () => this.error.set('The finance ERP record could not be saved.')
    });
  }

  private toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
