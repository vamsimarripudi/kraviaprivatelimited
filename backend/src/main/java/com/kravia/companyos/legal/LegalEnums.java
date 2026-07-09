package com.kravia.companyos.legal;

public final class LegalEnums {
    private LegalEnums() {}

    public enum ContractType {
        FOUNDER_AGREEMENT,
        CO_FOUNDER_AGREEMENT,
        SHAREHOLDER_AGREEMENT,
        VENDOR_AGREEMENT,
        CUSTOMER_AGREEMENT,
        NDA,
        EMPLOYMENT_AGREEMENT,
        CONSULTANT_AGREEMENT,
        RENT_AGREEMENT,
        BANK_AGREEMENT,
        SERVICE_AGREEMENT,
        OTHER
    }

    public enum LegalStatus {
        DRAFT,
        UNDER_REVIEW,
        PENDING_APPROVAL,
        APPROVED,
        SIGNED,
        ACTIVE,
        EXPIRED,
        TERMINATED,
        ARCHIVED
    }

    public enum SignatureStatus {
        NOT_REQUIRED,
        PENDING_SIGNATURE,
        PARTIALLY_SIGNED,
        SIGNED,
        DECLINED,
        EXPIRED
    }

    public enum LegalPriority {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    public enum LegalRiskSeverity {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    public enum LegalReportType {
        CONTRACT_SUMMARY,
        OBLIGATION_SUMMARY,
        RENEWAL_TRACKER,
        APPROVAL_SUMMARY,
        NOTICE_SUMMARY,
        RISK_SUMMARY
    }
}
