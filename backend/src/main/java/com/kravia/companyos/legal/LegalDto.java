package com.kravia.companyos.legal;

import com.kravia.companyos.legal.LegalEnums.ContractType;
import com.kravia.companyos.legal.LegalEnums.LegalPriority;
import com.kravia.companyos.legal.LegalEnums.LegalReportType;
import com.kravia.companyos.legal.LegalEnums.LegalRiskSeverity;
import com.kravia.companyos.legal.LegalEnums.LegalStatus;
import com.kravia.companyos.legal.LegalEnums.SignatureStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class LegalDto {
    private LegalDto() {}

    public record LegalMetric(String label, long value, String tone) {}
    public record LegalSummaryResponse(long activeContracts, long contractsUnderReview, long pendingSignatures, long upcomingRenewals, long expiringAgreements, long legalRisks, List<LegalMetric> metrics) {}

    public record ContractRequest(String contractTitle, ContractType contractType, String partiesInvolved, LocalDate effectiveDate, LocalDate expiryDate, LocalDate renewalDate, BigDecimal contractValue, LegalStatus status, LegalStatus approvalStatus, SignatureStatus signatureStatus, UUID relatedDocumentId, String responsiblePerson, String notes) {}
    public record ContractResponse(UUID id, String contractTitle, ContractType contractType, String partiesInvolved, LocalDate effectiveDate, LocalDate expiryDate, LocalDate renewalDate, BigDecimal contractValue, LegalStatus status, LegalStatus approvalStatus, SignatureStatus signatureStatus, UUID relatedDocumentId, String relatedDocumentTitle, String responsiblePerson, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record ObligationRequest(UUID contractId, String obligationTitle, String description, String responsiblePerson, LocalDate dueDate, LegalStatus status, LegalPriority priority, UUID relatedDocumentId, String notes) {}
    public record ObligationResponse(UUID id, UUID contractId, String contractTitle, String obligationTitle, String description, String responsiblePerson, LocalDate dueDate, LegalStatus status, LegalPriority priority, UUID relatedDocumentId, String relatedDocumentTitle, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record LegalApprovalRequest(UUID contractId, String approvalTitle, LegalStatus approvalStatus, String approver, String approvalNotes, LocalDate approvalDate, String rejectionReason, UUID relatedDocumentId, String notes) {}
    public record LegalApprovalResponse(UUID id, UUID contractId, String contractTitle, String approvalTitle, LegalStatus approvalStatus, String approver, String approvalNotes, LocalDate approvalDate, String rejectionReason, UUID relatedDocumentId, String relatedDocumentTitle, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record LegalNoticeRequest(String noticeTitle, String noticeType, String issuedBy, String issuedTo, LocalDate noticeDate, LocalDate responseDueDate, LegalStatus status, UUID relatedDocumentId, String responsiblePerson, String notes) {}
    public record LegalNoticeResponse(UUID id, String noticeTitle, String noticeType, String issuedBy, String issuedTo, LocalDate noticeDate, LocalDate responseDueDate, LegalStatus status, UUID relatedDocumentId, String relatedDocumentTitle, String responsiblePerson, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record LegalRiskRequest(UUID contractId, UUID riskRegisterEntryId, String riskTitle, LegalRiskSeverity severity, LegalStatus status, String owner, String mitigationPlan, LocalDate reviewDate, String notes) {}
    public record LegalRiskResponse(UUID id, UUID contractId, String contractTitle, UUID riskRegisterEntryId, String riskRegisterTitle, String riskTitle, LegalRiskSeverity severity, LegalStatus status, String owner, String mitigationPlan, LocalDate reviewDate, String notes, String createdBy, Instant createdAt, Instant updatedAt, Instant archivedAt) {}

    public record LegalReportResponse(LegalReportType reportType, Instant generatedAt, List<LegalMetric> metrics, List<String> notes) {}
}
