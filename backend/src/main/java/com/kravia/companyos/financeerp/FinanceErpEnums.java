package com.kravia.companyos.financeerp;

public final class FinanceErpEnums {
    private FinanceErpEnums() {}

    public enum AccountType {
        ASSETS,
        LIABILITIES,
        EQUITY,
        INCOME,
        EXPENSES,
        OTHER_INCOME,
        OTHER_EXPENSES
    }

    public enum RecordStatus {
        ACTIVE,
        INACTIVE,
        ARCHIVED
    }

    public enum JournalApprovalStatus {
        DRAFT,
        PENDING_APPROVAL,
        APPROVED,
        POSTED,
        REJECTED,
        ARCHIVED
    }

    public enum TransactionType {
        DEBIT,
        CREDIT
    }

    public enum ReconciliationStatus {
        UNRECONCILED,
        RECONCILED,
        REVIEW_REQUIRED,
        ARCHIVED
    }

    public enum InvoiceStatus {
        DRAFT,
        SENT,
        PARTIALLY_PAID,
        PAID,
        OVERDUE,
        CANCELLED,
        ARCHIVED
    }

    public enum ReceivableStatus {
        OPEN,
        PARTIAL,
        RECEIVED,
        OVERDUE,
        WRITTEN_OFF,
        ARCHIVED
    }

    public enum PaymentStatus {
        PENDING,
        SCHEDULED,
        PAID,
        OVERDUE,
        CANCELLED,
        ARCHIVED
    }

    public enum GstFilingStatus {
        DRAFT,
        READY,
        FILED,
        OVERDUE,
        NOT_APPLICABLE,
        ARCHIVED
    }

    public enum BudgetType {
        ANNUAL,
        DEPARTMENT,
        PRODUCT
    }

    public enum BudgetStatus {
        DRAFT,
        ACTIVE,
        CLOSED,
        ARCHIVED
    }

    public enum FinancialApprovalType {
        LARGE_EXPENSE,
        VENDOR_PAYMENT,
        BUDGET_CHANGE,
        JOURNAL_ENTRY
    }

    public enum FinancialApprovalStatus {
        DRAFT,
        PENDING_APPROVAL,
        APPROVED,
        REJECTED,
        CANCELLED,
        ARCHIVED
    }

    public enum FinanceReportType {
        TRIAL_BALANCE,
        BALANCE_SHEET,
        PROFIT_LOSS,
        CASH_FLOW,
        GST_SUMMARY,
        RECEIVABLES_AGING,
        PAYABLES_AGING,
        BUDGET_VARIANCE,
        BANK_RECONCILIATION_SUMMARY
    }
}
