package com.kravia.companyos.procurement;

public final class ProcurementEnums {
    private ProcurementEnums() {}

    public enum VendorCategory {
        SOFTWARE,
        CLOUD,
        LEGAL,
        COMPLIANCE,
        BANKING,
        DESIGN,
        DEVELOPMENT,
        MARKETING,
        OFFICE,
        OTHER
    }

    public enum ProcurementStatus {
        DRAFT,
        PENDING_APPROVAL,
        APPROVED,
        REJECTED,
        ACTIVE,
        PAID,
        UNPAID,
        OVERDUE,
        CANCELLED,
        ARCHIVED
    }

    public enum ProcurementPriority {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    public enum ProcurementReportType {
        VENDOR_SUMMARY,
        PURCHASE_REQUESTS,
        PURCHASE_ORDERS,
        VENDOR_BILLS,
        SUBSCRIPTIONS,
        APPROVALS,
        OVERDUE_PAYMENTS
    }
}
