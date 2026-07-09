package com.kravia.companyos.financeerp;

import com.kravia.companyos.financeerp.FinanceErpEnums.AccountType;
import com.kravia.companyos.financeerp.FinanceErpEnums.BudgetStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.BudgetType;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinancialApprovalStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.FinancialApprovalType;
import com.kravia.companyos.financeerp.FinanceErpEnums.GstFilingStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.InvoiceStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.JournalApprovalStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.PaymentStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.ReceivableStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.ReconciliationStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.RecordStatus;
import com.kravia.companyos.financeerp.FinanceErpEnums.TransactionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class FinanceErpDto {
    private FinanceErpDto() {}

    public record FinanceMetric(String label, BigDecimal value, String tone) {}
    public record FinanceCountMetric(String label, long value, String tone) {}

    public record FinanceDashboardResponse(
        BigDecimal cashPosition,
        BigDecimal bankBalances,
        BigDecimal monthlyRevenue,
        BigDecimal monthlyExpenses,
        BigDecimal profitOrLoss,
        BigDecimal accountsReceivable,
        BigDecimal accountsPayable,
        long upcomingPayments,
        long upcomingReceipts,
        BigDecimal gstSummary,
        List<FinanceMetric> financialHealthIndicators
    ) {}

    public record AccountRequest(
        @NotBlank @Size(max = 64) String accountCode,
        @NotBlank @Size(max = 255) String accountName,
        @NotNull AccountType accountType,
        UUID parentAccountId,
        @NotNull RecordStatus status
    ) {}

    public record AccountResponse(
        UUID id,
        String accountCode,
        String accountName,
        AccountType accountType,
        UUID parentAccountId,
        String parentAccountName,
        RecordStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static AccountResponse from(FinanceAccount account) {
            FinanceAccount parent = account.getParentAccount();
            return new AccountResponse(
                account.getId(),
                account.getAccountCode(),
                account.getAccountName(),
                account.getAccountType(),
                parent == null ? null : parent.getId(),
                parent == null ? null : parent.getAccountName(),
                account.getStatus(),
                account.getCreatedBy(),
                account.getCreatedAt(),
                account.getUpdatedAt(),
                account.getArchivedAt()
            );
        }
    }

    public record JournalLineRequest(
        @NotNull UUID accountId,
        BigDecimal debit,
        BigDecimal credit,
        @Size(max = 1000) String narration
    ) {}

    public record JournalEntryRequest(
        @NotBlank @Size(max = 120) String voucherNumber,
        @NotNull LocalDate postingDate,
        @NotBlank @Size(max = 4000) String narration,
        @NotNull JournalApprovalStatus approvalStatus,
        UUID linkedDocumentId,
        @Valid List<JournalLineRequest> lines
    ) {}

    public record JournalLineResponse(
        UUID id,
        UUID accountId,
        String accountCode,
        String accountName,
        BigDecimal debit,
        BigDecimal credit,
        String narration
    ) {
        public static JournalLineResponse from(JournalEntryLine line) {
            FinanceAccount account = line.getAccount();
            return new JournalLineResponse(
                line.getId(),
                account.getId(),
                account.getAccountCode(),
                account.getAccountName(),
                line.getDebit(),
                line.getCredit(),
                line.getNarration()
            );
        }
    }

    public record JournalEntryResponse(
        UUID id,
        String voucherNumber,
        LocalDate postingDate,
        String narration,
        JournalApprovalStatus approvalStatus,
        UUID linkedDocumentId,
        String createdBy,
        Instant postedAt,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt,
        BigDecimal totalDebit,
        BigDecimal totalCredit,
        List<JournalLineResponse> lines
    ) {
        public static JournalEntryResponse from(JournalEntry entry) {
            List<JournalLineResponse> lines = entry.getLines().stream().map(JournalLineResponse::from).toList();
            BigDecimal totalDebit = entry.getLines().stream().map(JournalEntryLine::getDebit).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal totalCredit = entry.getLines().stream().map(JournalEntryLine::getCredit).reduce(BigDecimal.ZERO, BigDecimal::add);
            return new JournalEntryResponse(
                entry.getId(),
                entry.getVoucherNumber(),
                entry.getPostingDate(),
                entry.getNarration(),
                entry.getApprovalStatus(),
                entry.getLinkedDocumentId(),
                entry.getCreatedBy(),
                entry.getPostedAt(),
                entry.getCreatedAt(),
                entry.getUpdatedAt(),
                entry.getArchivedAt(),
                totalDebit,
                totalCredit,
                lines
            );
        }
    }

    public record BankAccountRequest(
        @NotBlank @Size(max = 255) String bankName,
        @NotBlank @Size(max = 255) String accountName,
        @NotBlank @Size(max = 80) String accountNumberMasked,
        @Size(max = 32) String ifscCode,
        @Size(max = 255) String branch,
        BigDecimal currentBalance,
        @NotNull RecordStatus status
    ) {}

    public record BankAccountResponse(
        UUID id,
        String bankName,
        String accountName,
        String accountNumberMasked,
        String ifscCode,
        String branch,
        BigDecimal currentBalance,
        RecordStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static BankAccountResponse from(FinanceBankAccount account) {
            return new BankAccountResponse(account.getId(), account.getBankName(), account.getAccountName(), account.getAccountNumberMasked(), account.getIfscCode(), account.getBranch(), account.getCurrentBalance(), account.getStatus(), account.getCreatedBy(), account.getCreatedAt(), account.getUpdatedAt(), account.getArchivedAt());
        }
    }

    public record BankTransactionRequest(
        @NotNull UUID bankAccountId,
        @NotNull LocalDate transactionDate,
        @NotBlank @Size(max = 1000) String description,
        BigDecimal amount,
        @NotNull TransactionType transactionType,
        @NotNull ReconciliationStatus reconciliationStatus,
        UUID linkedJournalEntryId
    ) {}

    public record BankTransactionResponse(
        UUID id,
        UUID bankAccountId,
        String bankName,
        String accountName,
        LocalDate transactionDate,
        String description,
        BigDecimal amount,
        TransactionType transactionType,
        ReconciliationStatus reconciliationStatus,
        UUID linkedJournalEntryId,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static BankTransactionResponse from(BankTransaction transaction) {
            FinanceBankAccount account = transaction.getBankAccount();
            JournalEntry journalEntry = transaction.getLinkedJournalEntry();
            return new BankTransactionResponse(transaction.getId(), account.getId(), account.getBankName(), account.getAccountName(), transaction.getTransactionDate(), transaction.getDescription(), transaction.getAmount(), transaction.getTransactionType(), transaction.getReconciliationStatus(), journalEntry == null ? null : journalEntry.getId(), transaction.getCreatedBy(), transaction.getCreatedAt(), transaction.getUpdatedAt(), transaction.getArchivedAt());
        }
    }

    public record InvoiceRequest(
        @NotBlank @Size(max = 120) String invoiceNumber,
        @NotBlank @Size(max = 255) String customerName,
        @NotNull LocalDate invoiceDate,
        @NotNull LocalDate dueDate,
        BigDecimal totalAmount,
        BigDecimal outstandingAmount,
        @NotNull InvoiceStatus status
    ) {}

    public record InvoiceResponse(
        UUID id,
        String invoiceNumber,
        String customerName,
        LocalDate invoiceDate,
        LocalDate dueDate,
        BigDecimal totalAmount,
        BigDecimal outstandingAmount,
        InvoiceStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static InvoiceResponse from(Invoice invoice) {
            return new InvoiceResponse(invoice.getId(), invoice.getInvoiceNumber(), invoice.getCustomerName(), invoice.getInvoiceDate(), invoice.getDueDate(), invoice.getTotalAmount(), invoice.getOutstandingAmount(), invoice.getStatus(), invoice.getCreatedBy(), invoice.getCreatedAt(), invoice.getUpdatedAt(), invoice.getArchivedAt());
        }
    }

    public record ReceivableRequest(
        @NotBlank @Size(max = 255) String customerName,
        UUID invoiceId,
        @NotNull LocalDate dueDate,
        BigDecimal outstandingAmount,
        @NotNull ReceivableStatus status,
        @Size(max = 120) String reminderStatus
    ) {}

    public record ReceivableResponse(
        UUID id,
        String customerName,
        UUID invoiceId,
        String invoiceNumber,
        LocalDate dueDate,
        BigDecimal outstandingAmount,
        ReceivableStatus status,
        String reminderStatus,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static ReceivableResponse from(CustomerReceivable receivable) {
            Invoice invoice = receivable.getInvoice();
            return new ReceivableResponse(receivable.getId(), receivable.getCustomerName(), invoice == null ? null : invoice.getId(), invoice == null ? null : invoice.getInvoiceNumber(), receivable.getDueDate(), receivable.getOutstandingAmount(), receivable.getStatus(), receivable.getReminderStatus(), receivable.getCreatedBy(), receivable.getCreatedAt(), receivable.getUpdatedAt(), receivable.getArchivedAt());
        }
    }

    public record PayableRequest(
        @NotBlank @Size(max = 255) String vendorName,
        @NotBlank @Size(max = 120) String billNumber,
        @NotNull LocalDate dueDate,
        BigDecimal amount,
        @NotNull PaymentStatus paymentStatus
    ) {}

    public record PayableResponse(
        UUID id,
        String vendorName,
        String billNumber,
        LocalDate dueDate,
        BigDecimal amount,
        PaymentStatus paymentStatus,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static PayableResponse from(VendorPayable payable) {
            return new PayableResponse(payable.getId(), payable.getVendorName(), payable.getBillNumber(), payable.getDueDate(), payable.getAmount(), payable.getPaymentStatus(), payable.getCreatedBy(), payable.getCreatedAt(), payable.getUpdatedAt(), payable.getArchivedAt());
        }
    }

    public record GstRecordRequest(
        @NotBlank @Size(max = 7) String filingPeriod,
        BigDecimal gstCollected,
        BigDecimal gstPaid,
        BigDecimal inputTaxCredit,
        BigDecimal outputTax,
        @NotNull GstFilingStatus filingStatus
    ) {}

    public record GstRecordResponse(
        UUID id,
        String filingPeriod,
        BigDecimal gstCollected,
        BigDecimal gstPaid,
        BigDecimal inputTaxCredit,
        BigDecimal outputTax,
        BigDecimal netGstPosition,
        GstFilingStatus filingStatus,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static GstRecordResponse from(GstRecord record) {
            return new GstRecordResponse(record.getId(), record.getFilingPeriod(), record.getGstCollected(), record.getGstPaid(), record.getInputTaxCredit(), record.getOutputTax(), record.getNetGstPosition(), record.getFilingStatus(), record.getCreatedBy(), record.getCreatedAt(), record.getUpdatedAt(), record.getArchivedAt());
        }
    }

    public record BudgetLineRequest(
        UUID accountId,
        @NotBlank @Size(max = 255) String lineName,
        BigDecimal plannedAmount,
        BigDecimal actualAmount
    ) {}

    public record BudgetRequest(
        @NotBlank @Size(max = 255) String budgetName,
        @NotNull BudgetType budgetType,
        @NotBlank @Size(max = 9) String financialYear,
        @Size(max = 255) String department,
        @Size(max = 255) String product,
        BigDecimal annualBudget,
        @NotNull BudgetStatus status,
        @Valid List<BudgetLineRequest> lines
    ) {}

    public record BudgetLineResponse(
        UUID id,
        UUID accountId,
        String accountCode,
        String lineName,
        BigDecimal plannedAmount,
        BigDecimal actualAmount,
        BigDecimal varianceAmount
    ) {
        public static BudgetLineResponse from(BudgetLine line) {
            FinanceAccount account = line.getAccount();
            return new BudgetLineResponse(line.getId(), account == null ? null : account.getId(), account == null ? null : account.getAccountCode(), line.getLineName(), line.getPlannedAmount(), line.getActualAmount(), line.getVarianceAmount());
        }
    }

    public record BudgetResponse(
        UUID id,
        String budgetName,
        BudgetType budgetType,
        String financialYear,
        String department,
        String product,
        BigDecimal annualBudget,
        BudgetStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt,
        List<BudgetLineResponse> lines
    ) {
        public static BudgetResponse from(Budget budget) {
            return new BudgetResponse(budget.getId(), budget.getBudgetName(), budget.getBudgetType(), budget.getFinancialYear(), budget.getDepartment(), budget.getProduct(), budget.getAnnualBudget(), budget.getStatus(), budget.getCreatedBy(), budget.getCreatedAt(), budget.getUpdatedAt(), budget.getArchivedAt(), budget.getLines().stream().map(BudgetLineResponse::from).toList());
        }
    }

    public record ApprovalRequest(
        @NotNull FinancialApprovalType approvalType,
        @NotBlank @Size(max = 255) String title,
        BigDecimal amount,
        @NotNull FinancialApprovalStatus status,
        @Size(max = 255) String approver,
        @Size(max = 4000) String approvalNotes,
        LocalDate approvalDate,
        @Size(max = 120) String linkedRecordType,
        UUID linkedRecordId,
        @Size(max = 4000) String rejectionReason
    ) {}

    public record ApprovalResponse(
        UUID id,
        FinancialApprovalType approvalType,
        String title,
        BigDecimal amount,
        FinancialApprovalStatus status,
        String requestedBy,
        String approver,
        String approvalNotes,
        LocalDate approvalDate,
        String linkedRecordType,
        UUID linkedRecordId,
        String rejectionReason,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {
        public static ApprovalResponse from(FinancialApproval approval) {
            return new ApprovalResponse(approval.getId(), approval.getApprovalType(), approval.getTitle(), approval.getAmount(), approval.getStatus(), approval.getRequestedBy(), approval.getApprover(), approval.getApprovalNotes(), approval.getApprovalDate(), approval.getLinkedRecordType(), approval.getLinkedRecordId(), approval.getRejectionReason(), approval.getCreatedAt(), approval.getUpdatedAt(), approval.getArchivedAt());
        }
    }

    public record FinanceReportResponse(
        String reportType,
        Instant generatedAt,
        List<FinanceMetric> metrics,
        List<FinanceCountMetric> counts,
        List<String> notes
    ) {}
}
