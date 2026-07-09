package com.kravia.companyos.financeerp;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.finance.FinancialRecord;
import com.kravia.companyos.finance.FinancialRecordRepository;
import com.kravia.companyos.financeerp.FinanceErpDto.AccountRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.AccountResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.ApprovalRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.ApprovalResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.BankAccountRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.BankAccountResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.BankTransactionRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.BankTransactionResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.BudgetLineRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.BudgetRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.BudgetResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.FinanceCountMetric;
import com.kravia.companyos.financeerp.FinanceErpDto.FinanceDashboardResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.FinanceMetric;
import com.kravia.companyos.financeerp.FinanceErpDto.FinanceReportResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.GstRecordRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.GstRecordResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.InvoiceRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.InvoiceResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.JournalEntryRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.JournalEntryResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.JournalLineRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.PayableRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.PayableResponse;
import com.kravia.companyos.financeerp.FinanceErpDto.ReceivableRequest;
import com.kravia.companyos.financeerp.FinanceErpDto.ReceivableResponse;
import com.kravia.companyos.financeerp.FinanceErpEnums.AccountType;
import com.kravia.companyos.financeerp.FinanceErpEnums.BudgetStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinanceReportType;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinancialApprovalStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.GstFilingStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.InvoiceStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.JournalApprovalStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.PaymentStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.ReceivableStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.ReconciliationStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.RecordStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.TransactionType;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinanceErpService {
    private static final String MODULE = "FINANCE_ERP";
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final FinanceAccountRepository accounts;
    private final JournalEntryRepository journalEntries;
    private final FinanceBankAccountRepository bankAccounts;
    private final BankTransactionRepository bankTransactions;
    private final InvoiceRepository invoices;
    private final CustomerReceivableRepository receivables;
    private final VendorPayableRepository payables;
    private final GstRecordRepository gstRecords;
    private final BudgetRepository budgets;
    private final FinancialApprovalRepository approvals;
    private final FinancialRecordRepository monthlyRecords;
    private final PermissionService permissions;
    private final AuditService auditService;

    public FinanceErpService(
        FinanceAccountRepository accounts,
        JournalEntryRepository journalEntries,
        FinanceBankAccountRepository bankAccounts,
        BankTransactionRepository bankTransactions,
        InvoiceRepository invoices,
        CustomerReceivableRepository receivables,
        VendorPayableRepository payables,
        GstRecordRepository gstRecords,
        BudgetRepository budgets,
        FinancialApprovalRepository approvals,
        FinancialRecordRepository monthlyRecords,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.accounts = accounts;
        this.journalEntries = journalEntries;
        this.bankAccounts = bankAccounts;
        this.bankTransactions = bankTransactions;
        this.invoices = invoices;
        this.receivables = receivables;
        this.payables = payables;
        this.gstRecords = gstRecords;
        this.budgets = budgets;
        this.approvals = approvals;
        this.monthlyRecords = monthlyRecords;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public FinanceDashboardResponse dashboard(AppUser actor) {
        requireViewer(actor);
        BigDecimal cash = bankAccounts.findAll().stream().filter(this::active).map(FinanceBankAccount::getCurrentBalance).reduce(ZERO, BigDecimal::add);
        FinancialRecord latest = monthlyRecords.findAll().stream()
            .filter(record -> record.getArchivedAt() == null)
            .max(Comparator.comparing(FinancialRecord::getReportingMonth))
            .orElse(null);
        BigDecimal monthlyRevenue = latest == null ? ZERO : latest.getRevenue();
        BigDecimal monthlyExpenses = latest == null ? ZERO : latest.getExpenses();
        BigDecimal profitLoss = latest == null ? ZERO : latest.getProfitOrLoss();
        BigDecimal receivableTotal = receivables.findAll().stream().filter(this::openReceivable).map(CustomerReceivable::getOutstandingAmount).reduce(ZERO, BigDecimal::add);
        BigDecimal payableTotal = payables.findAll().stream().filter(this::openPayable).map(VendorPayable::getAmount).reduce(ZERO, BigDecimal::add);
        LocalDate today = LocalDate.now();
        LocalDate nextMonth = today.plusDays(30);
        long upcomingPayments = payables.findAll().stream().filter(this::openPayable).filter(payable -> !payable.getDueDate().isBefore(today) && !payable.getDueDate().isAfter(nextMonth)).count();
        long upcomingReceipts = receivables.findAll().stream().filter(this::openReceivable).filter(receivable -> !receivable.getDueDate().isBefore(today) && !receivable.getDueDate().isAfter(nextMonth)).count();
        BigDecimal gstSummary = gstRecords.findAll().stream().filter(record -> record.getArchivedAt() == null).map(GstRecord::getNetGstPosition).reduce(ZERO, BigDecimal::add);
        List<FinanceMetric> indicators = List.of(
            new FinanceMetric("Cash position", cash, tone(cash)),
            new FinanceMetric("Working capital", receivableTotal.subtract(payableTotal).setScale(2, RoundingMode.HALF_UP), tone(receivableTotal.subtract(payableTotal))),
            new FinanceMetric("Monthly profit / loss", profitLoss, tone(profitLoss)),
            new FinanceMetric("Net GST position", gstSummary, tone(gstSummary))
        );
        return new FinanceDashboardResponse(cash, cash, monthlyRevenue, monthlyExpenses, profitLoss, receivableTotal, payableTotal, upcomingPayments, upcomingReceipts, gstSummary, indicators);
    }

    @Transactional(readOnly = true)
    public List<AccountResponse> listAccounts(String query, AccountType type, RecordStatus status, AppUser actor) {
        requireViewer(actor);
        return accounts.findAllByOrderByAccountCodeAsc().stream()
            .filter(account -> type == null || account.getAccountType() == type)
            .filter(account -> status == null || account.getStatus() == status)
            .filter(account -> matches(query, account.getAccountCode(), account.getAccountName()))
            .map(AccountResponse::from)
            .toList();
    }

    @Transactional
    public AccountResponse createAccount(AccountRequest request, AppUser actor) {
        requireEditor(actor);
        validateAccount(request, null);
        FinanceAccount account = new FinanceAccount();
        account.setCreatedBy(actor.getDisplayName());
        applyAccount(account, request);
        FinanceAccount saved = accounts.saveAndFlush(account);
        audit(actor, "FINANCE_ACCOUNT_CREATED", "Created account " + saved.getAccountCode(), "IMPORTANT");
        return AccountResponse.from(saved);
    }

    @Transactional
    public AccountResponse updateAccount(UUID id, AccountRequest request, AppUser actor) {
        requireEditor(actor);
        FinanceAccount account = findAccount(id);
        validateAccount(request, account);
        applyAccount(account, request);
        if (account.getStatus() == RecordStatus.ARCHIVED) account.setArchivedAt(Instant.now());
        FinanceAccount saved = accounts.saveAndFlush(account);
        audit(actor, "FINANCE_ACCOUNT_UPDATED", "Updated account " + saved.getAccountCode(), "IMPORTANT");
        return AccountResponse.from(saved);
    }

    @Transactional
    public void archiveAccount(UUID id, AppUser actor) {
        requireFounder(actor);
        FinanceAccount account = findAccount(id);
        account.setStatus(RecordStatus.ARCHIVED);
        account.setArchivedAt(Instant.now());
        audit(actor, "FINANCE_ACCOUNT_ARCHIVED", "Archived account " + account.getAccountCode(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<JournalEntryResponse> listJournalEntries(String query, JournalApprovalStatus status, AppUser actor) {
        requireViewer(actor);
        return journalEntries.findAllByOrderByPostingDateDescCreatedAtDesc().stream()
            .filter(entry -> status == null || entry.getApprovalStatus() == status)
            .filter(entry -> matches(query, entry.getVoucherNumber(), entry.getNarration(), entry.getCreatedBy()))
            .map(JournalEntryResponse::from)
            .toList();
    }

    @Transactional
    public JournalEntryResponse createJournalEntry(JournalEntryRequest request, AppUser actor) {
        requireEditor(actor);
        validateJournal(request, null);
        JournalEntry entry = new JournalEntry();
        entry.setCreatedBy(actor.getDisplayName());
        applyJournal(entry, request);
        JournalEntry saved = journalEntries.saveAndFlush(entry);
        audit(actor, "JOURNAL_ENTRY_CREATED", "Created journal voucher " + saved.getVoucherNumber(), "IMPORTANT");
        return JournalEntryResponse.from(saved);
    }

    @Transactional
    public JournalEntryResponse updateJournalEntry(UUID id, JournalEntryRequest request, AppUser actor) {
        requireEditor(actor);
        JournalEntry entry = findJournal(id);
        ensureJournalEditable(entry);
        validateJournal(request, entry);
        JournalApprovalStatus previousStatus = entry.getApprovalStatus();
        applyJournal(entry, request);
        if (entry.getApprovalStatus() == JournalApprovalStatus.ARCHIVED) entry.setArchivedAt(Instant.now());
        JournalEntry saved = journalEntries.saveAndFlush(entry);
        audit(actor, "JOURNAL_ENTRY_UPDATED", "Updated journal voucher " + saved.getVoucherNumber(), "IMPORTANT");
        if (previousStatus != saved.getApprovalStatus()) audit(actor, "JOURNAL_STATUS_CHANGED", "Changed journal voucher " + saved.getVoucherNumber() + " to " + saved.getApprovalStatus(), "IMPORTANT");
        return JournalEntryResponse.from(saved);
    }

    @Transactional
    public void archiveJournalEntry(UUID id, AppUser actor) {
        requireFounder(actor);
        JournalEntry entry = findJournal(id);
        ensureJournalEditable(entry);
        entry.setApprovalStatus(JournalApprovalStatus.ARCHIVED);
        entry.setArchivedAt(Instant.now());
        audit(actor, "JOURNAL_ENTRY_ARCHIVED", "Archived journal voucher " + entry.getVoucherNumber(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<BankAccountResponse> listBankAccounts(String query, AppUser actor) {
        requireViewer(actor);
        return bankAccounts.findAllByOrderByBankNameAscAccountNameAsc().stream()
            .filter(account -> matches(query, account.getBankName(), account.getAccountName(), account.getAccountNumberMasked()))
            .map(BankAccountResponse::from)
            .toList();
    }

    @Transactional
    public BankAccountResponse createBankAccount(BankAccountRequest request, AppUser actor) {
        requireEditor(actor);
        FinanceBankAccount account = new FinanceBankAccount();
        account.setCreatedBy(actor.getDisplayName());
        applyBankAccount(account, request);
        FinanceBankAccount saved = bankAccounts.saveAndFlush(account);
        audit(actor, "BANK_ACCOUNT_CREATED", "Created bank account " + saved.getAccountName(), "IMPORTANT");
        return BankAccountResponse.from(saved);
    }

    @Transactional
    public BankAccountResponse updateBankAccount(UUID id, BankAccountRequest request, AppUser actor) {
        requireEditor(actor);
        FinanceBankAccount account = findBankAccount(id);
        applyBankAccount(account, request);
        if (account.getStatus() == RecordStatus.ARCHIVED) account.setArchivedAt(Instant.now());
        FinanceBankAccount saved = bankAccounts.saveAndFlush(account);
        audit(actor, "BANK_ACCOUNT_UPDATED", "Updated bank account " + saved.getAccountName(), "IMPORTANT");
        return BankAccountResponse.from(saved);
    }

    @Transactional
    public void archiveBankAccount(UUID id, AppUser actor) {
        requireFounder(actor);
        FinanceBankAccount account = findBankAccount(id);
        account.setStatus(RecordStatus.ARCHIVED);
        account.setArchivedAt(Instant.now());
        audit(actor, "BANK_ACCOUNT_ARCHIVED", "Archived bank account " + account.getAccountName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<BankTransactionResponse> listBankTransactions(String query, ReconciliationStatus status, AppUser actor) {
        requireViewer(actor);
        return bankTransactions.findAllByOrderByTransactionDateDescCreatedAtDesc().stream()
            .filter(transaction -> status == null || transaction.getReconciliationStatus() == status)
            .filter(transaction -> matches(query, transaction.getDescription(), transaction.getBankAccount().getBankName(), transaction.getBankAccount().getAccountName()))
            .map(BankTransactionResponse::from)
            .toList();
    }

    @Transactional
    public BankTransactionResponse createBankTransaction(BankTransactionRequest request, AppUser actor) {
        requireEditor(actor);
        BankTransaction transaction = new BankTransaction();
        transaction.setCreatedBy(actor.getDisplayName());
        applyBankTransaction(transaction, request);
        BankTransaction saved = bankTransactions.saveAndFlush(transaction);
        audit(actor, "BANK_TRANSACTION_CREATED", "Created bank transaction " + saved.getDescription(), "IMPORTANT");
        return BankTransactionResponse.from(saved);
    }

    @Transactional
    public BankTransactionResponse updateBankTransaction(UUID id, BankTransactionRequest request, AppUser actor) {
        requireEditor(actor);
        BankTransaction transaction = findBankTransaction(id);
        applyBankTransaction(transaction, request);
        if (transaction.getReconciliationStatus() == ReconciliationStatus.ARCHIVED) transaction.setArchivedAt(Instant.now());
        BankTransaction saved = bankTransactions.saveAndFlush(transaction);
        audit(actor, "BANK_TRANSACTION_UPDATED", "Updated bank transaction " + saved.getDescription(), "IMPORTANT");
        return BankTransactionResponse.from(saved);
    }

    @Transactional
    public void archiveBankTransaction(UUID id, AppUser actor) {
        requireFounder(actor);
        BankTransaction transaction = findBankTransaction(id);
        transaction.setReconciliationStatus(ReconciliationStatus.ARCHIVED);
        transaction.setArchivedAt(Instant.now());
        audit(actor, "BANK_TRANSACTION_ARCHIVED", "Archived bank transaction " + transaction.getDescription(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<InvoiceResponse> listInvoices(String query, InvoiceStatus status, AppUser actor) {
        requireViewer(actor);
        return invoices.findAllByOrderByDueDateAscCreatedAtDesc().stream()
            .filter(invoice -> status == null || invoice.getStatus() == status)
            .filter(invoice -> matches(query, invoice.getInvoiceNumber(), invoice.getCustomerName()))
            .map(InvoiceResponse::from)
            .toList();
    }

    @Transactional
    public InvoiceResponse createInvoice(InvoiceRequest request, AppUser actor) {
        requireEditor(actor);
        validateInvoice(request, null);
        Invoice invoice = new Invoice();
        invoice.setCreatedBy(actor.getDisplayName());
        applyInvoice(invoice, request);
        Invoice saved = invoices.saveAndFlush(invoice);
        audit(actor, "INVOICE_CREATED", "Created invoice " + saved.getInvoiceNumber(), "IMPORTANT");
        return InvoiceResponse.from(saved);
    }

    @Transactional
    public InvoiceResponse updateInvoice(UUID id, InvoiceRequest request, AppUser actor) {
        requireEditor(actor);
        Invoice invoice = findInvoice(id);
        validateInvoice(request, invoice);
        applyInvoice(invoice, request);
        if (invoice.getStatus() == InvoiceStatus.ARCHIVED) invoice.setArchivedAt(Instant.now());
        Invoice saved = invoices.saveAndFlush(invoice);
        audit(actor, "INVOICE_UPDATED", "Updated invoice " + saved.getInvoiceNumber(), "IMPORTANT");
        return InvoiceResponse.from(saved);
    }

    @Transactional
    public void archiveInvoice(UUID id, AppUser actor) {
        requireFounder(actor);
        Invoice invoice = findInvoice(id);
        invoice.setStatus(InvoiceStatus.ARCHIVED);
        invoice.setArchivedAt(Instant.now());
        audit(actor, "INVOICE_ARCHIVED", "Archived invoice " + invoice.getInvoiceNumber(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<ReceivableResponse> listReceivables(String query, ReceivableStatus status, AppUser actor) {
        requireViewer(actor);
        return receivables.findAllByOrderByDueDateAscCreatedAtDesc().stream()
            .filter(receivable -> status == null || receivable.getStatus() == status)
            .filter(receivable -> matches(query, receivable.getCustomerName(), receivable.getReminderStatus()))
            .map(ReceivableResponse::from)
            .toList();
    }

    @Transactional
    public ReceivableResponse createReceivable(ReceivableRequest request, AppUser actor) {
        requireEditor(actor);
        CustomerReceivable receivable = new CustomerReceivable();
        receivable.setCreatedBy(actor.getDisplayName());
        applyReceivable(receivable, request);
        CustomerReceivable saved = receivables.saveAndFlush(receivable);
        audit(actor, "RECEIVABLE_CREATED", "Created receivable for " + saved.getCustomerName(), "IMPORTANT");
        return ReceivableResponse.from(saved);
    }

    @Transactional
    public ReceivableResponse updateReceivable(UUID id, ReceivableRequest request, AppUser actor) {
        requireEditor(actor);
        CustomerReceivable receivable = findReceivable(id);
        applyReceivable(receivable, request);
        if (receivable.getStatus() == ReceivableStatus.ARCHIVED) receivable.setArchivedAt(Instant.now());
        CustomerReceivable saved = receivables.saveAndFlush(receivable);
        audit(actor, "RECEIVABLE_UPDATED", "Updated receivable for " + saved.getCustomerName(), "IMPORTANT");
        return ReceivableResponse.from(saved);
    }

    @Transactional
    public void archiveReceivable(UUID id, AppUser actor) {
        requireFounder(actor);
        CustomerReceivable receivable = findReceivable(id);
        receivable.setStatus(ReceivableStatus.ARCHIVED);
        receivable.setArchivedAt(Instant.now());
        audit(actor, "RECEIVABLE_ARCHIVED", "Archived receivable for " + receivable.getCustomerName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<PayableResponse> listPayables(String query, PaymentStatus status, AppUser actor) {
        requireViewer(actor);
        return payables.findAllByOrderByDueDateAscCreatedAtDesc().stream()
            .filter(payable -> status == null || payable.getPaymentStatus() == status)
            .filter(payable -> matches(query, payable.getVendorName(), payable.getBillNumber()))
            .map(PayableResponse::from)
            .toList();
    }

    @Transactional
    public PayableResponse createPayable(PayableRequest request, AppUser actor) {
        requireEditor(actor);
        VendorPayable payable = new VendorPayable();
        payable.setCreatedBy(actor.getDisplayName());
        applyPayable(payable, request);
        VendorPayable saved = payables.saveAndFlush(payable);
        audit(actor, "PAYABLE_CREATED", "Created payable for " + saved.getVendorName(), "IMPORTANT");
        return PayableResponse.from(saved);
    }

    @Transactional
    public PayableResponse updatePayable(UUID id, PayableRequest request, AppUser actor) {
        requireEditor(actor);
        VendorPayable payable = findPayable(id);
        applyPayable(payable, request);
        if (payable.getPaymentStatus() == PaymentStatus.ARCHIVED) payable.setArchivedAt(Instant.now());
        VendorPayable saved = payables.saveAndFlush(payable);
        audit(actor, "PAYABLE_UPDATED", "Updated payable for " + saved.getVendorName(), "IMPORTANT");
        return PayableResponse.from(saved);
    }

    @Transactional
    public void archivePayable(UUID id, AppUser actor) {
        requireFounder(actor);
        VendorPayable payable = findPayable(id);
        payable.setPaymentStatus(PaymentStatus.ARCHIVED);
        payable.setArchivedAt(Instant.now());
        audit(actor, "PAYABLE_ARCHIVED", "Archived payable for " + payable.getVendorName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<GstRecordResponse> listGstRecords(String query, GstFilingStatus status, AppUser actor) {
        requireViewer(actor);
        return gstRecords.findAllByOrderByFilingPeriodDescCreatedAtDesc().stream()
            .filter(record -> status == null || record.getFilingStatus() == status)
            .filter(record -> matches(query, record.getFilingPeriod()))
            .map(GstRecordResponse::from)
            .toList();
    }

    @Transactional
    public GstRecordResponse createGstRecord(GstRecordRequest request, AppUser actor) {
        requireEditor(actor);
        GstRecord record = new GstRecord();
        record.setCreatedBy(actor.getDisplayName());
        applyGst(record, request);
        GstRecord saved = gstRecords.saveAndFlush(record);
        audit(actor, "GST_RECORD_CREATED", "Created GST record for " + saved.getFilingPeriod(), "IMPORTANT");
        return GstRecordResponse.from(saved);
    }

    @Transactional
    public GstRecordResponse updateGstRecord(UUID id, GstRecordRequest request, AppUser actor) {
        requireEditor(actor);
        GstRecord record = findGstRecord(id);
        applyGst(record, request);
        if (record.getFilingStatus() == GstFilingStatus.ARCHIVED) record.setArchivedAt(Instant.now());
        GstRecord saved = gstRecords.saveAndFlush(record);
        audit(actor, "GST_RECORD_UPDATED", "Updated GST record for " + saved.getFilingPeriod(), "IMPORTANT");
        return GstRecordResponse.from(saved);
    }

    @Transactional
    public void archiveGstRecord(UUID id, AppUser actor) {
        requireFounder(actor);
        GstRecord record = findGstRecord(id);
        record.setFilingStatus(GstFilingStatus.ARCHIVED);
        record.setArchivedAt(Instant.now());
        audit(actor, "GST_RECORD_ARCHIVED", "Archived GST record for " + record.getFilingPeriod(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<BudgetResponse> listBudgets(String query, BudgetStatus status, AppUser actor) {
        requireViewer(actor);
        return budgets.findAllByOrderByFinancialYearDescCreatedAtDesc().stream()
            .filter(budget -> status == null || budget.getStatus() == status)
            .filter(budget -> matches(query, budget.getBudgetName(), budget.getFinancialYear(), budget.getDepartment(), budget.getProduct()))
            .map(BudgetResponse::from)
            .toList();
    }

    @Transactional
    public BudgetResponse createBudget(BudgetRequest request, AppUser actor) {
        requireEditor(actor);
        Budget budget = new Budget();
        budget.setCreatedBy(actor.getDisplayName());
        applyBudget(budget, request);
        Budget saved = budgets.saveAndFlush(budget);
        audit(actor, "BUDGET_CREATED", "Created budget " + saved.getBudgetName(), "IMPORTANT");
        return BudgetResponse.from(saved);
    }

    @Transactional
    public BudgetResponse updateBudget(UUID id, BudgetRequest request, AppUser actor) {
        requireEditor(actor);
        Budget budget = findBudget(id);
        applyBudget(budget, request);
        if (budget.getStatus() == BudgetStatus.ARCHIVED) budget.setArchivedAt(Instant.now());
        Budget saved = budgets.saveAndFlush(budget);
        audit(actor, "BUDGET_UPDATED", "Updated budget " + saved.getBudgetName(), "IMPORTANT");
        return BudgetResponse.from(saved);
    }

    @Transactional
    public void archiveBudget(UUID id, AppUser actor) {
        requireFounder(actor);
        Budget budget = findBudget(id);
        budget.setStatus(BudgetStatus.ARCHIVED);
        budget.setArchivedAt(Instant.now());
        audit(actor, "BUDGET_ARCHIVED", "Archived budget " + budget.getBudgetName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<ApprovalResponse> listApprovals(String query, FinancialApprovalStatus status, AppUser actor) {
        requireViewer(actor);
        return approvals.findAllByOrderByCreatedAtDesc().stream()
            .filter(approval -> status == null || approval.getStatus() == status)
            .filter(approval -> matches(query, approval.getTitle(), approval.getRequestedBy(), approval.getApprover()))
            .map(ApprovalResponse::from)
            .toList();
    }

    @Transactional
    public ApprovalResponse createApproval(ApprovalRequest request, AppUser actor) {
        requireEditor(actor);
        FinancialApproval approval = new FinancialApproval();
        approval.setRequestedBy(actor.getDisplayName());
        applyApproval(approval, request);
        FinancialApproval saved = approvals.saveAndFlush(approval);
        audit(actor, "FINANCIAL_APPROVAL_CREATED", "Created financial approval " + saved.getTitle(), "IMPORTANT");
        return ApprovalResponse.from(saved);
    }

    @Transactional
    public ApprovalResponse updateApproval(UUID id, ApprovalRequest request, AppUser actor) {
        requireEditor(actor);
        FinancialApproval approval = findApproval(id);
        FinancialApprovalStatus previousStatus = approval.getStatus();
        applyApproval(approval, request);
        if (approval.getStatus() == FinancialApprovalStatus.ARCHIVED) approval.setArchivedAt(Instant.now());
        FinancialApproval saved = approvals.saveAndFlush(approval);
        audit(actor, "FINANCIAL_APPROVAL_UPDATED", "Updated financial approval " + saved.getTitle(), "IMPORTANT");
        if (previousStatus != saved.getStatus()) audit(actor, "FINANCIAL_APPROVAL_STATUS_CHANGED", "Changed financial approval " + saved.getTitle() + " to " + saved.getStatus(), "IMPORTANT");
        return ApprovalResponse.from(saved);
    }

    @Transactional
    public void archiveApproval(UUID id, AppUser actor) {
        requireFounder(actor);
        FinancialApproval approval = findApproval(id);
        approval.setStatus(FinancialApprovalStatus.ARCHIVED);
        approval.setArchivedAt(Instant.now());
        audit(actor, "FINANCIAL_APPROVAL_ARCHIVED", "Archived financial approval " + approval.getTitle(), "WARNING");
    }

    @Transactional(readOnly = true)
    public FinanceReportResponse report(FinanceReportType type, AppUser actor) {
        requireViewer(actor);
        List<FinanceMetric> metrics = new ArrayList<>();
        List<FinanceCountMetric> counts = new ArrayList<>();
        List<String> notes = new ArrayList<>();
        switch (type) {
            case TRIAL_BALANCE -> buildTrialBalance(metrics);
            case BALANCE_SHEET -> buildBalanceSheet(metrics);
            case PROFIT_LOSS -> buildProfitLoss(metrics);
            case CASH_FLOW -> buildCashFlow(metrics);
            case GST_SUMMARY -> buildGstSummary(metrics, counts);
            case RECEIVABLES_AGING -> buildReceivablesAging(metrics, counts);
            case PAYABLES_AGING -> buildPayablesAging(metrics, counts);
            case BUDGET_VARIANCE -> buildBudgetVariance(metrics, counts);
            case BANK_RECONCILIATION_SUMMARY -> buildBankReconciliation(metrics, counts);
        }
        if (metrics.isEmpty() && counts.isEmpty()) notes.add("No information has been added yet.");
        audit(actor, "FINANCE_REPORT_GENERATED", "Generated finance ERP report " + type, "INFO");
        return new FinanceReportResponse(type.name(), Instant.now(), metrics, counts, notes);
    }

    private void applyAccount(FinanceAccount account, AccountRequest request) {
        account.setAccountCode(required(request.accountCode(), "Account code"));
        account.setAccountName(required(request.accountName(), "Account name"));
        account.setAccountType(required(request.accountType(), "Account type"));
        account.setStatus(required(request.status(), "Account status"));
        if (request.parentAccountId() == null) {
            account.setParentAccount(null);
        } else {
            FinanceAccount parent = findAccount(request.parentAccountId());
            if (account.getId() != null && account.getId().equals(parent.getId())) throw new IllegalArgumentException("Parent account cannot be the same account.");
            account.setParentAccount(parent);
        }
    }

    private void validateAccount(AccountRequest request, FinanceAccount existing) {
        String code = required(request.accountCode(), "Account code");
        if ((existing == null || !existing.getAccountCode().equalsIgnoreCase(code)) && accounts.existsByAccountCodeIgnoreCase(code)) {
            throw new IllegalArgumentException("Account code already exists.");
        }
    }

    private void applyJournal(JournalEntry entry, JournalEntryRequest request) {
        entry.setVoucherNumber(required(request.voucherNumber(), "Voucher number"));
        entry.setPostingDate(required(request.postingDate(), "Posting date"));
        entry.setNarration(required(request.narration(), "Narration"));
        entry.setApprovalStatus(required(request.approvalStatus(), "Approval status"));
        entry.setLinkedDocumentId(request.linkedDocumentId());
        if (request.approvalStatus() == JournalApprovalStatus.POSTED && entry.getPostedAt() == null) entry.setPostedAt(Instant.now());
        entry.getLines().clear();
        for (JournalLineRequest lineRequest : request.lines()) {
            JournalEntryLine line = new JournalEntryLine();
            line.setJournalEntry(entry);
            line.setAccount(findAccount(lineRequest.accountId()));
            line.setDebit(money(lineRequest.debit(), "Debit", false));
            line.setCredit(money(lineRequest.credit(), "Credit", false));
            line.setNarration(blankToNull(lineRequest.narration()));
            entry.getLines().add(line);
        }
    }

    private void validateJournal(JournalEntryRequest request, JournalEntry existing) {
        String voucher = required(request.voucherNumber(), "Voucher number");
        if ((existing == null || !existing.getVoucherNumber().equalsIgnoreCase(voucher)) && journalEntries.existsByVoucherNumberIgnoreCase(voucher)) {
            throw new IllegalArgumentException("Voucher number already exists.");
        }
        if (request.lines() == null || request.lines().size() < 2) throw new IllegalArgumentException("At least two journal lines are required.");
        BigDecimal debit = ZERO;
        BigDecimal credit = ZERO;
        for (JournalLineRequest line : request.lines()) {
            BigDecimal lineDebit = money(line.debit(), "Debit", false);
            BigDecimal lineCredit = money(line.credit(), "Credit", false);
            if (lineDebit.signum() > 0 && lineCredit.signum() > 0) throw new IllegalArgumentException("A journal line cannot contain both debit and credit.");
            if (lineDebit.signum() == 0 && lineCredit.signum() == 0) throw new IllegalArgumentException("Every journal line must contain a debit or credit amount.");
            debit = debit.add(lineDebit);
            credit = credit.add(lineCredit);
        }
        if (debit.compareTo(credit) != 0) throw new IllegalArgumentException("Journal entry must balance: total debit must equal total credit.");
    }

    private void ensureJournalEditable(JournalEntry entry) {
        if (entry.getApprovalStatus() == JournalApprovalStatus.POSTED) throw new ForbiddenOperationException("Posted journal entries are immutable.");
    }

    private void applyBankAccount(FinanceBankAccount account, BankAccountRequest request) {
        account.setBankName(required(request.bankName(), "Bank name"));
        account.setAccountName(required(request.accountName(), "Account name"));
        account.setAccountNumberMasked(required(request.accountNumberMasked(), "Account number"));
        account.setIfscCode(blankToNull(request.ifscCode()));
        account.setBranch(blankToNull(request.branch()));
        account.setCurrentBalance(money(request.currentBalance(), "Current balance", false));
        account.setStatus(required(request.status(), "Bank account status"));
    }

    private void applyBankTransaction(BankTransaction transaction, BankTransactionRequest request) {
        transaction.setBankAccount(findBankAccount(request.bankAccountId()));
        transaction.setTransactionDate(required(request.transactionDate(), "Transaction date"));
        transaction.setDescription(required(request.description(), "Description"));
        transaction.setAmount(money(request.amount(), "Transaction amount", true));
        transaction.setTransactionType(required(request.transactionType(), "Transaction type"));
        transaction.setReconciliationStatus(required(request.reconciliationStatus(), "Reconciliation status"));
        transaction.setLinkedJournalEntry(request.linkedJournalEntryId() == null ? null : findJournal(request.linkedJournalEntryId()));
    }

    private void applyInvoice(Invoice invoice, InvoiceRequest request) {
        invoice.setInvoiceNumber(required(request.invoiceNumber(), "Invoice number"));
        invoice.setCustomerName(required(request.customerName(), "Customer name"));
        invoice.setInvoiceDate(required(request.invoiceDate(), "Invoice date"));
        invoice.setDueDate(required(request.dueDate(), "Due date"));
        invoice.setTotalAmount(money(request.totalAmount(), "Total amount", true));
        invoice.setOutstandingAmount(money(request.outstandingAmount(), "Outstanding amount", false));
        invoice.setStatus(required(request.status(), "Invoice status"));
    }

    private void validateInvoice(InvoiceRequest request, Invoice existing) {
        String invoiceNumber = required(request.invoiceNumber(), "Invoice number");
        if ((existing == null || !existing.getInvoiceNumber().equalsIgnoreCase(invoiceNumber)) && invoices.existsByInvoiceNumberIgnoreCase(invoiceNumber)) {
            throw new IllegalArgumentException("Invoice number already exists.");
        }
        BigDecimal total = money(request.totalAmount(), "Total amount", true);
        BigDecimal outstanding = money(request.outstandingAmount(), "Outstanding amount", false);
        if (outstanding.compareTo(total) > 0) throw new IllegalArgumentException("Outstanding amount cannot exceed invoice total.");
        if (request.dueDate() != null && request.invoiceDate() != null && request.dueDate().isBefore(request.invoiceDate())) throw new IllegalArgumentException("Due date cannot be before invoice date.");
    }

    private void applyReceivable(CustomerReceivable receivable, ReceivableRequest request) {
        receivable.setCustomerName(required(request.customerName(), "Customer name"));
        receivable.setInvoice(request.invoiceId() == null ? null : findInvoice(request.invoiceId()));
        receivable.setDueDate(required(request.dueDate(), "Due date"));
        receivable.setOutstandingAmount(money(request.outstandingAmount(), "Outstanding amount", true));
        receivable.setStatus(required(request.status(), "Receivable status"));
        receivable.setReminderStatus(blankToNull(request.reminderStatus()));
    }

    private void applyPayable(VendorPayable payable, PayableRequest request) {
        payable.setVendorName(required(request.vendorName(), "Vendor name"));
        payable.setBillNumber(required(request.billNumber(), "Bill number"));
        payable.setDueDate(required(request.dueDate(), "Due date"));
        payable.setAmount(money(request.amount(), "Payable amount", true));
        payable.setPaymentStatus(required(request.paymentStatus(), "Payment status"));
    }

    private void applyGst(GstRecord record, GstRecordRequest request) {
        String period = required(request.filingPeriod(), "Filing period");
        try {
            YearMonth.parse(period);
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("Filing period must use YYYY-MM format.");
        }
        BigDecimal collected = money(request.gstCollected(), "GST collected", false);
        BigDecimal paid = money(request.gstPaid(), "GST paid", false);
        BigDecimal credit = money(request.inputTaxCredit(), "Input tax credit", false);
        BigDecimal output = money(request.outputTax(), "Output tax", false);
        record.setFilingPeriod(period);
        record.setGstCollected(collected);
        record.setGstPaid(paid);
        record.setInputTaxCredit(credit);
        record.setOutputTax(output);
        record.setNetGstPosition(collected.add(output).subtract(paid).subtract(credit).setScale(2, RoundingMode.HALF_UP));
        record.setFilingStatus(required(request.filingStatus(), "Filing status"));
    }

    private void applyBudget(Budget budget, BudgetRequest request) {
        budget.setBudgetName(required(request.budgetName(), "Budget name"));
        budget.setBudgetType(required(request.budgetType(), "Budget type"));
        budget.setFinancialYear(required(request.financialYear(), "Financial year"));
        budget.setDepartment(blankToNull(request.department()));
        budget.setProduct(blankToNull(request.product()));
        budget.setAnnualBudget(money(request.annualBudget(), "Annual budget", false));
        budget.setStatus(required(request.status(), "Budget status"));
        budget.getLines().clear();
        if (request.lines() == null) return;
        for (BudgetLineRequest lineRequest : request.lines()) {
            BudgetLine line = new BudgetLine();
            BigDecimal planned = money(lineRequest.plannedAmount(), "Planned amount", false);
            BigDecimal actual = money(lineRequest.actualAmount(), "Actual amount", false);
            line.setBudget(budget);
            line.setAccount(lineRequest.accountId() == null ? null : findAccount(lineRequest.accountId()));
            line.setLineName(required(lineRequest.lineName(), "Budget line name"));
            line.setPlannedAmount(planned);
            line.setActualAmount(actual);
            line.setVarianceAmount(actual.subtract(planned).setScale(2, RoundingMode.HALF_UP));
            budget.getLines().add(line);
        }
    }

    private void applyApproval(FinancialApproval approval, ApprovalRequest request) {
        approval.setApprovalType(required(request.approvalType(), "Approval type"));
        approval.setTitle(required(request.title(), "Approval title"));
        approval.setAmount(money(request.amount(), "Approval amount", false));
        approval.setStatus(required(request.status(), "Approval status"));
        approval.setApprover(blankToNull(request.approver()));
        approval.setApprovalNotes(blankToNull(request.approvalNotes()));
        approval.setApprovalDate(request.approvalDate());
        approval.setLinkedRecordType(blankToNull(request.linkedRecordType()));
        approval.setLinkedRecordId(request.linkedRecordId());
        approval.setRejectionReason(blankToNull(request.rejectionReason()));
        if (request.status() == FinancialApprovalStatus.REJECTED && approval.getRejectionReason() == null) throw new IllegalArgumentException("Rejection reason is required when approval is rejected.");
        if (request.status() == FinancialApprovalStatus.APPROVED && approval.getApprovalDate() == null) approval.setApprovalDate(LocalDate.now());
    }

    private void buildTrialBalance(List<FinanceMetric> metrics) {
        BigDecimal debit = ZERO;
        BigDecimal credit = ZERO;
        for (JournalEntry entry : postedJournals()) {
            debit = debit.add(entry.getLines().stream().map(JournalEntryLine::getDebit).reduce(ZERO, BigDecimal::add));
            credit = credit.add(entry.getLines().stream().map(JournalEntryLine::getCredit).reduce(ZERO, BigDecimal::add));
        }
        metrics.add(new FinanceMetric("Total debit", debit, "neutral"));
        metrics.add(new FinanceMetric("Total credit", credit, "neutral"));
        metrics.add(new FinanceMetric("Difference", debit.subtract(credit).setScale(2, RoundingMode.HALF_UP), tone(debit.subtract(credit).negate())));
    }

    private void buildBalanceSheet(List<FinanceMetric> metrics) {
        metrics.add(new FinanceMetric("Assets", balanceFor(AccountType.ASSETS), "neutral"));
        metrics.add(new FinanceMetric("Liabilities", balanceFor(AccountType.LIABILITIES), "neutral"));
        metrics.add(new FinanceMetric("Equity", balanceFor(AccountType.EQUITY), "neutral"));
    }

    private void buildProfitLoss(List<FinanceMetric> metrics) {
        BigDecimal income = balanceFor(AccountType.INCOME).add(balanceFor(AccountType.OTHER_INCOME));
        BigDecimal expenses = balanceFor(AccountType.EXPENSES).add(balanceFor(AccountType.OTHER_EXPENSES));
        metrics.add(new FinanceMetric("Income", income, "positive"));
        metrics.add(new FinanceMetric("Expenses", expenses, "neutral"));
        metrics.add(new FinanceMetric("Profit / loss", income.subtract(expenses).setScale(2, RoundingMode.HALF_UP), tone(income.subtract(expenses))));
    }

    private void buildCashFlow(List<FinanceMetric> metrics) {
        BigDecimal inflow = bankTransactions.findAll().stream().filter(transaction -> transaction.getArchivedAt() == null && transaction.getTransactionType() == TransactionType.CREDIT).map(BankTransaction::getAmount).reduce(ZERO, BigDecimal::add);
        BigDecimal outflow = bankTransactions.findAll().stream().filter(transaction -> transaction.getArchivedAt() == null && transaction.getTransactionType() == TransactionType.DEBIT).map(BankTransaction::getAmount).reduce(ZERO, BigDecimal::add);
        metrics.add(new FinanceMetric("Cash inflow", inflow, "positive"));
        metrics.add(new FinanceMetric("Cash outflow", outflow, "neutral"));
        metrics.add(new FinanceMetric("Net cash flow", inflow.subtract(outflow).setScale(2, RoundingMode.HALF_UP), tone(inflow.subtract(outflow))));
    }

    private void buildGstSummary(List<FinanceMetric> metrics, List<FinanceCountMetric> counts) {
        List<GstRecord> records = gstRecords.findAll().stream().filter(record -> record.getArchivedAt() == null).toList();
        metrics.add(new FinanceMetric("GST collected", records.stream().map(GstRecord::getGstCollected).reduce(ZERO, BigDecimal::add), "neutral"));
        metrics.add(new FinanceMetric("GST paid", records.stream().map(GstRecord::getGstPaid).reduce(ZERO, BigDecimal::add), "neutral"));
        metrics.add(new FinanceMetric("Net GST position", records.stream().map(GstRecord::getNetGstPosition).reduce(ZERO, BigDecimal::add), "neutral"));
        counts.add(new FinanceCountMetric("Filed periods", records.stream().filter(record -> record.getFilingStatus() == GstFilingStatus.FILED).count(), "positive"));
        counts.add(new FinanceCountMetric("Open periods", records.stream().filter(record -> record.getFilingStatus() != GstFilingStatus.FILED).count(), "warning"));
    }

    private void buildReceivablesAging(List<FinanceMetric> metrics, List<FinanceCountMetric> counts) {
        List<CustomerReceivable> open = receivables.findAll().stream().filter(this::openReceivable).toList();
        LocalDate today = LocalDate.now();
        metrics.add(new FinanceMetric("Open receivables", open.stream().map(CustomerReceivable::getOutstandingAmount).reduce(ZERO, BigDecimal::add), "neutral"));
        metrics.add(new FinanceMetric("Overdue receivables", open.stream().filter(receivable -> receivable.getDueDate().isBefore(today)).map(CustomerReceivable::getOutstandingAmount).reduce(ZERO, BigDecimal::add), "negative"));
        counts.add(new FinanceCountMetric("Open records", open.size(), "neutral"));
        counts.add(new FinanceCountMetric("Overdue records", open.stream().filter(receivable -> receivable.getDueDate().isBefore(today)).count(), "negative"));
    }

    private void buildPayablesAging(List<FinanceMetric> metrics, List<FinanceCountMetric> counts) {
        List<VendorPayable> open = payables.findAll().stream().filter(this::openPayable).toList();
        LocalDate today = LocalDate.now();
        metrics.add(new FinanceMetric("Open payables", open.stream().map(VendorPayable::getAmount).reduce(ZERO, BigDecimal::add), "neutral"));
        metrics.add(new FinanceMetric("Overdue payables", open.stream().filter(payable -> payable.getDueDate().isBefore(today)).map(VendorPayable::getAmount).reduce(ZERO, BigDecimal::add), "negative"));
        counts.add(new FinanceCountMetric("Open records", open.size(), "neutral"));
        counts.add(new FinanceCountMetric("Overdue records", open.stream().filter(payable -> payable.getDueDate().isBefore(today)).count(), "negative"));
    }

    private void buildBudgetVariance(List<FinanceMetric> metrics, List<FinanceCountMetric> counts) {
        List<BudgetLine> lines = budgets.findAll().stream().filter(budget -> budget.getArchivedAt() == null).flatMap(budget -> budget.getLines().stream()).toList();
        BigDecimal planned = lines.stream().map(BudgetLine::getPlannedAmount).reduce(ZERO, BigDecimal::add);
        BigDecimal actual = lines.stream().map(BudgetLine::getActualAmount).reduce(ZERO, BigDecimal::add);
        metrics.add(new FinanceMetric("Planned budget", planned, "neutral"));
        metrics.add(new FinanceMetric("Actual spend", actual, "neutral"));
        metrics.add(new FinanceMetric("Variance", actual.subtract(planned).setScale(2, RoundingMode.HALF_UP), tone(planned.subtract(actual))));
        counts.add(new FinanceCountMetric("Budget lines", lines.size(), "neutral"));
    }

    private void buildBankReconciliation(List<FinanceMetric> metrics, List<FinanceCountMetric> counts) {
        List<BankTransaction> transactions = bankTransactions.findAll().stream().filter(transaction -> transaction.getArchivedAt() == null).toList();
        counts.add(new FinanceCountMetric("Reconciled", transactions.stream().filter(transaction -> transaction.getReconciliationStatus() == ReconciliationStatus.RECONCILED).count(), "positive"));
        counts.add(new FinanceCountMetric("Unreconciled", transactions.stream().filter(transaction -> transaction.getReconciliationStatus() == ReconciliationStatus.UNRECONCILED).count(), "warning"));
        counts.add(new FinanceCountMetric("Review required", transactions.stream().filter(transaction -> transaction.getReconciliationStatus() == ReconciliationStatus.REVIEW_REQUIRED).count(), "negative"));
    }

    private BigDecimal balanceFor(AccountType type) {
        BigDecimal balance = ZERO;
        for (JournalEntry entry : postedJournals()) {
            for (JournalEntryLine line : entry.getLines()) {
                if (line.getAccount().getAccountType() != type) continue;
                if (type == AccountType.LIABILITIES || type == AccountType.EQUITY || type == AccountType.INCOME || type == AccountType.OTHER_INCOME) {
                    balance = balance.add(line.getCredit()).subtract(line.getDebit());
                } else {
                    balance = balance.add(line.getDebit()).subtract(line.getCredit());
                }
            }
        }
        return balance.setScale(2, RoundingMode.HALF_UP);
    }

    private List<JournalEntry> postedJournals() {
        return journalEntries.findAll().stream().filter(entry -> entry.getApprovalStatus() == JournalApprovalStatus.POSTED && entry.getArchivedAt() == null).toList();
    }

    private boolean active(FinanceBankAccount account) { return account.getArchivedAt() == null && account.getStatus() != RecordStatus.ARCHIVED; }
    private boolean openReceivable(CustomerReceivable receivable) { return receivable.getArchivedAt() == null && receivable.getStatus() != ReceivableStatus.RECEIVED && receivable.getStatus() != ReceivableStatus.WRITTEN_OFF && receivable.getStatus() != ReceivableStatus.ARCHIVED; }
    private boolean openPayable(VendorPayable payable) { return payable.getArchivedAt() == null && payable.getPaymentStatus() != PaymentStatus.PAID && payable.getPaymentStatus() != PaymentStatus.CANCELLED && payable.getPaymentStatus() != PaymentStatus.ARCHIVED; }

    private FinanceAccount findAccount(UUID id) { return accounts.findById(id).orElseThrow(() -> new NotFoundException("Account not found.")); }
    private JournalEntry findJournal(UUID id) { return journalEntries.findById(id).orElseThrow(() -> new NotFoundException("Journal entry not found.")); }
    private FinanceBankAccount findBankAccount(UUID id) { return bankAccounts.findById(id).orElseThrow(() -> new NotFoundException("Bank account not found.")); }
    private BankTransaction findBankTransaction(UUID id) { return bankTransactions.findById(id).orElseThrow(() -> new NotFoundException("Bank transaction not found.")); }
    private Invoice findInvoice(UUID id) { return invoices.findById(id).orElseThrow(() -> new NotFoundException("Invoice not found.")); }
    private CustomerReceivable findReceivable(UUID id) { return receivables.findById(id).orElseThrow(() -> new NotFoundException("Receivable not found.")); }
    private VendorPayable findPayable(UUID id) { return payables.findById(id).orElseThrow(() -> new NotFoundException("Payable not found.")); }
    private GstRecord findGstRecord(UUID id) { return gstRecords.findById(id).orElseThrow(() -> new NotFoundException("GST record not found.")); }
    private Budget findBudget(UUID id) { return budgets.findById(id).orElseThrow(() -> new NotFoundException("Budget not found.")); }
    private FinancialApproval findApproval(UUID id) { return approvals.findById(id).orElseThrow(() -> new NotFoundException("Financial approval not found.")); }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private void requireFounder(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER); }
    private void audit(AppUser actor, String action, String description, String severity) { auditService.record(actor, MODULE, action, description, severity); }

    private boolean matches(String query, String... values) {
        if (query == null || query.isBlank()) return true;
        String normalized = query.toLowerCase(Locale.ROOT).trim();
        for (String value : values) {
            if (value != null && value.toLowerCase(Locale.ROOT).contains(normalized)) return true;
        }
        return false;
    }

    private BigDecimal money(BigDecimal value, String label, boolean required) {
        if (value == null) {
            if (required) throw new IllegalArgumentException(label + " is required.");
            return ZERO;
        }
        if (value.scale() > 2) throw new IllegalArgumentException(label + " must have no more than 2 decimal places.");
        if (value.signum() < 0) throw new IllegalArgumentException(label + " cannot be negative.");
        if (value.precision() - value.scale() > 17) throw new IllegalArgumentException(label + " is too large.");
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String required(String value, String label) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(label + " is required.");
        return value.trim();
    }

    private <T> T required(T value, String label) {
        if (value == null) throw new IllegalArgumentException(label + " is required.");
        return value;
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String tone(BigDecimal value) { return value.signum() > 0 ? "positive" : value.signum() < 0 ? "negative" : "neutral"; }
}
