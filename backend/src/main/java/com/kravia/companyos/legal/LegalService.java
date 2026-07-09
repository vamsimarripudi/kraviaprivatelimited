package com.kravia.companyos.legal;

import com.kravia.companyos.announcement.AnnouncementAudience;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.document.DocumentRepository;
import com.kravia.companyos.legal.LegalDto.ContractRequest;
import com.kravia.companyos.legal.LegalDto.ContractResponse;
import com.kravia.companyos.legal.LegalDto.LegalApprovalRequest;
import com.kravia.companyos.legal.LegalDto.LegalApprovalResponse;
import com.kravia.companyos.legal.LegalDto.LegalMetric;
import com.kravia.companyos.legal.LegalDto.LegalNoticeRequest;
import com.kravia.companyos.legal.LegalDto.LegalNoticeResponse;
import com.kravia.companyos.legal.LegalDto.LegalReportResponse;
import com.kravia.companyos.legal.LegalDto.LegalRiskRequest;
import com.kravia.companyos.legal.LegalDto.LegalRiskResponse;
import com.kravia.companyos.legal.LegalDto.LegalSummaryResponse;
import com.kravia.companyos.legal.LegalDto.ObligationRequest;
import com.kravia.companyos.legal.LegalDto.ObligationResponse;
import com.kravia.companyos.legal.LegalEnums.ContractType;
import com.kravia.companyos.legal.LegalEnums.LegalPriority;
import com.kravia.companyos.legal.LegalEnums.LegalReportType;
import com.kravia.companyos.legal.LegalEnums.LegalRiskSeverity;
import com.kravia.companyos.legal.LegalEnums.LegalStatus;
import com.kravia.companyos.legal.LegalEnums.SignatureStatus;
import com.kravia.companyos.notification.NotificationService;
import com.kravia.companyos.notification.NotificationType;
import com.kravia.companyos.risk.RiskRegisterEntry;
import com.kravia.companyos.risk.RiskRegisterRepository;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LegalService {
    private static final String MODULE = "LEGAL";
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final LegalContractRepository contracts;
    private final LegalObligationRepository obligations;
    private final LegalApprovalRepository approvals;
    private final LegalNoticeRepository notices;
    private final LegalRiskLinkRepository risks;
    private final DocumentRepository documents;
    private final RiskRegisterRepository riskRegister;
    private final PermissionService permissions;
    private final AuditService auditService;
    private final NotificationService notificationService;

    public LegalService(
        LegalContractRepository contracts,
        LegalObligationRepository obligations,
        LegalApprovalRepository approvals,
        LegalNoticeRepository notices,
        LegalRiskLinkRepository risks,
        DocumentRepository documents,
        RiskRegisterRepository riskRegister,
        PermissionService permissions,
        AuditService auditService,
        NotificationService notificationService
    ) {
        this.contracts = contracts;
        this.obligations = obligations;
        this.approvals = approvals;
        this.notices = notices;
        this.risks = risks;
        this.documents = documents;
        this.riskRegister = riskRegister;
        this.permissions = permissions;
        this.auditService = auditService;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public LegalSummaryResponse summary(AppUser actor) {
        requireViewer(actor);
        LocalDate today = LocalDate.now();
        LocalDate nextMonth = today.plusDays(30);
        List<LegalContract> records = contracts.findAll();
        long activeContracts = records.stream().filter(contract -> contract.getArchivedAt() == null && contract.getStatus() == LegalStatus.ACTIVE).count();
        long underReview = records.stream().filter(contract -> contract.getArchivedAt() == null && contract.getStatus() == LegalStatus.UNDER_REVIEW).count();
        long pendingSignatures = records.stream().filter(contract -> contract.getArchivedAt() == null && (contract.getSignatureStatus() == SignatureStatus.PENDING_SIGNATURE || contract.getSignatureStatus() == SignatureStatus.PARTIALLY_SIGNED)).count();
        long upcomingRenewals = records.stream().filter(contract -> isUpcoming(contract.getRenewalDate(), today, nextMonth)).count();
        long expiringAgreements = records.stream().filter(contract -> isUpcoming(contract.getExpiryDate(), today, nextMonth)).count();
        long legalRisks = risks.findAll().stream().filter(risk -> risk.getArchivedAt() == null && risk.getStatus() != LegalStatus.ARCHIVED).count();
        List<LegalMetric> metrics = List.of(
            new LegalMetric("Active contracts", activeContracts, "neutral"),
            new LegalMetric("Contracts under review", underReview, underReview == 0 ? "positive" : "warning"),
            new LegalMetric("Pending signatures", pendingSignatures, pendingSignatures == 0 ? "positive" : "warning"),
            new LegalMetric("Upcoming renewals", upcomingRenewals, upcomingRenewals == 0 ? "positive" : "warning"),
            new LegalMetric("Expiring agreements", expiringAgreements, expiringAgreements == 0 ? "positive" : "warning"),
            new LegalMetric("Legal risks", legalRisks, legalRisks == 0 ? "positive" : "warning")
        );
        return new LegalSummaryResponse(activeContracts, underReview, pendingSignatures, upcomingRenewals, expiringAgreements, legalRisks, metrics);
    }

    @Transactional(readOnly = true)
    public List<ContractResponse> contracts(String query, ContractType type, LegalStatus status, AppUser actor) {
        requireViewer(actor);
        return contracts.findAllByOrderByUpdatedAtDesc().stream()
            .filter(item -> type == null || item.getContractType() == type)
            .filter(item -> status == null || item.getStatus() == status)
            .filter(item -> matches(query, item.getContractTitle(), item.getPartiesInvolved(), item.getResponsiblePerson(), item.getNotes()))
            .map(this::toContractResponse)
            .toList();
    }

    @Transactional
    public ContractResponse saveContract(UUID id, ContractRequest request, AppUser actor) {
        requireEditor(actor);
        LegalContract contract = id == null ? new LegalContract() : findContract(id);
        LocalDate previousRenewal = contract.getRenewalDate();
        contract.setContractTitle(required(request.contractTitle(), "Contract title"));
        contract.setContractType(required(request.contractType(), "Contract type"));
        contract.setPartiesInvolved(blankToNull(request.partiesInvolved()));
        contract.setEffectiveDate(request.effectiveDate());
        contract.setExpiryDate(request.expiryDate());
        contract.setRenewalDate(request.renewalDate());
        contract.setContractValue(money(request.contractValue()));
        contract.setStatus(required(request.status(), "Status"));
        contract.setApprovalStatus(required(request.approvalStatus(), "Approval status"));
        contract.setSignatureStatus(required(request.signatureStatus(), "Signature status"));
        contract.setRelatedDocument(findDocument(request.relatedDocumentId()));
        contract.setResponsiblePerson(blankToNull(request.responsiblePerson()));
        contract.setNotes(blankToNull(request.notes()));
        if (contract.getCreatedBy() == null) contract.setCreatedBy(actor.getEmail());
        LegalContract saved = contracts.save(contract);
        audit(actor, id == null ? "CONTRACT_CREATED" : "CONTRACT_UPDATED", "Saved legal contract " + saved.getContractTitle(), "IMPORTANT");
        notifyRenewalIfNeeded(previousRenewal, saved, actor);
        return toContractResponse(saved);
    }

    @Transactional
    public void archiveContract(UUID id, AppUser actor) {
        requireFounder(actor);
        LegalContract contract = findContract(id);
        contract.setStatus(LegalStatus.ARCHIVED);
        contract.setArchivedAt(Instant.now());
        contracts.save(contract);
        audit(actor, "CONTRACT_ARCHIVED", "Archived legal contract " + contract.getContractTitle(), "IMPORTANT");
    }

    @Transactional(readOnly = true)
    public List<ObligationResponse> obligations(String query, LegalStatus status, LegalPriority priority, AppUser actor) {
        requireViewer(actor);
        return obligations.findAllByOrderByDueDateAscUpdatedAtDesc().stream()
            .filter(item -> status == null || item.getStatus() == status)
            .filter(item -> priority == null || item.getPriority() == priority)
            .filter(item -> matches(query, item.getObligationTitle(), item.getDescription(), item.getResponsiblePerson(), contractTitle(item.getContract())))
            .map(this::toObligationResponse)
            .toList();
    }

    @Transactional
    public ObligationResponse saveObligation(UUID id, ObligationRequest request, AppUser actor) {
        requireEditor(actor);
        LegalObligation obligation = id == null ? new LegalObligation() : findObligation(id);
        obligation.setContract(findContractOrNull(request.contractId()));
        obligation.setObligationTitle(required(request.obligationTitle(), "Obligation title"));
        obligation.setDescription(blankToNull(request.description()));
        obligation.setResponsiblePerson(required(request.responsiblePerson(), "Responsible person"));
        obligation.setDueDate(request.dueDate());
        obligation.setStatus(required(request.status(), "Status"));
        obligation.setPriority(required(request.priority(), "Priority"));
        obligation.setRelatedDocument(findDocument(request.relatedDocumentId()));
        obligation.setNotes(blankToNull(request.notes()));
        if (obligation.getCreatedBy() == null) obligation.setCreatedBy(actor.getEmail());
        LegalObligation saved = obligations.save(obligation);
        audit(actor, id == null ? "OBLIGATION_CREATED" : "OBLIGATION_UPDATED", "Saved legal obligation " + saved.getObligationTitle(), "IMPORTANT");
        return toObligationResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<LegalApprovalResponse> approvals(String query, LegalStatus status, AppUser actor) {
        requireViewer(actor);
        return approvals.findAllByOrderByUpdatedAtDesc().stream()
            .filter(item -> status == null || item.getApprovalStatus() == status)
            .filter(item -> matches(query, item.getApprovalTitle(), item.getApprover(), item.getApprovalNotes(), contractTitle(item.getContract())))
            .map(this::toApprovalResponse)
            .toList();
    }

    @Transactional
    public LegalApprovalResponse saveApproval(UUID id, LegalApprovalRequest request, AppUser actor) {
        requireEditor(actor);
        LegalApproval approval = id == null ? new LegalApproval() : findApproval(id);
        approval.setContract(findContractOrNull(request.contractId()));
        approval.setApprovalTitle(required(request.approvalTitle(), "Approval title"));
        approval.setApprovalStatus(required(request.approvalStatus(), "Approval status"));
        approval.setApprover(blankToNull(request.approver()));
        approval.setApprovalNotes(blankToNull(request.approvalNotes()));
        approval.setApprovalDate(request.approvalDate());
        approval.setRejectionReason(blankToNull(request.rejectionReason()));
        approval.setRelatedDocument(findDocument(request.relatedDocumentId()));
        approval.setNotes(blankToNull(request.notes()));
        if (approval.getCreatedBy() == null) approval.setCreatedBy(actor.getEmail());
        LegalApproval saved = approvals.save(approval);
        audit(actor, id == null ? "LEGAL_APPROVAL_CREATED" : "LEGAL_APPROVAL_UPDATED", "Saved legal approval " + saved.getApprovalTitle(), "IMPORTANT");
        return toApprovalResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<LegalNoticeResponse> notices(String query, LegalStatus status, AppUser actor) {
        requireViewer(actor);
        return notices.findAllByOrderByNoticeDateDescUpdatedAtDesc().stream()
            .filter(item -> status == null || item.getStatus() == status)
            .filter(item -> matches(query, item.getNoticeTitle(), item.getNoticeType(), item.getIssuedBy(), item.getIssuedTo(), item.getResponsiblePerson()))
            .map(this::toNoticeResponse)
            .toList();
    }

    @Transactional
    public LegalNoticeResponse saveNotice(UUID id, LegalNoticeRequest request, AppUser actor) {
        requireEditor(actor);
        LegalNotice notice = id == null ? new LegalNotice() : findNotice(id);
        notice.setNoticeTitle(required(request.noticeTitle(), "Notice title"));
        notice.setNoticeType(blankToNull(request.noticeType()));
        notice.setIssuedBy(blankToNull(request.issuedBy()));
        notice.setIssuedTo(required(request.issuedTo(), "Issued to"));
        notice.setNoticeDate(required(request.noticeDate(), "Notice date"));
        notice.setResponseDueDate(request.responseDueDate());
        notice.setStatus(required(request.status(), "Status"));
        notice.setRelatedDocument(findDocument(request.relatedDocumentId()));
        notice.setResponsiblePerson(blankToNull(request.responsiblePerson()));
        notice.setNotes(blankToNull(request.notes()));
        if (notice.getCreatedBy() == null) notice.setCreatedBy(actor.getEmail());
        LegalNotice saved = notices.save(notice);
        audit(actor, id == null ? "LEGAL_NOTICE_CREATED" : "LEGAL_NOTICE_UPDATED", "Saved legal notice " + saved.getNoticeTitle(), "IMPORTANT");
        return toNoticeResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<LegalRiskResponse> risks(String query, LegalRiskSeverity severity, LegalStatus status, AppUser actor) {
        requireViewer(actor);
        return risks.findAllByOrderByUpdatedAtDesc().stream()
            .filter(item -> severity == null || item.getSeverity() == severity)
            .filter(item -> status == null || item.getStatus() == status)
            .filter(item -> matches(query, item.getRiskTitle(), item.getOwner(), item.getMitigationPlan(), contractTitle(item.getContract()), riskTitle(item.getRiskRegisterEntry())))
            .map(this::toRiskResponse)
            .toList();
    }

    @Transactional
    public LegalRiskResponse saveRisk(UUID id, LegalRiskRequest request, AppUser actor) {
        requireEditor(actor);
        LegalRiskLink risk = id == null ? new LegalRiskLink() : findRisk(id);
        risk.setContract(findContractOrNull(request.contractId()));
        risk.setRiskRegisterEntry(findRiskRegisterEntry(request.riskRegisterEntryId()));
        risk.setRiskTitle(required(request.riskTitle(), "Risk title"));
        risk.setSeverity(required(request.severity(), "Severity"));
        risk.setStatus(required(request.status(), "Status"));
        risk.setOwner(blankToNull(request.owner()));
        risk.setMitigationPlan(blankToNull(request.mitigationPlan()));
        risk.setReviewDate(request.reviewDate());
        risk.setNotes(blankToNull(request.notes()));
        if (risk.getCreatedBy() == null) risk.setCreatedBy(actor.getEmail());
        LegalRiskLink saved = risks.save(risk);
        audit(actor, id == null ? "LEGAL_RISK_CREATED" : "LEGAL_RISK_UPDATED", "Saved legal risk " + saved.getRiskTitle(), "IMPORTANT");
        return toRiskResponse(saved);
    }

    @Transactional
    public void archive(UUID id, String type, AppUser actor) {
        requireFounder(actor);
        switch (type) {
            case "obligation" -> { LegalObligation item = findObligation(id); item.setStatus(LegalStatus.ARCHIVED); item.setArchivedAt(Instant.now()); obligations.save(item); }
            case "approval" -> { LegalApproval item = findApproval(id); item.setApprovalStatus(LegalStatus.ARCHIVED); item.setArchivedAt(Instant.now()); approvals.save(item); }
            case "notice" -> { LegalNotice item = findNotice(id); item.setStatus(LegalStatus.ARCHIVED); item.setArchivedAt(Instant.now()); notices.save(item); }
            case "risk" -> { LegalRiskLink item = findRisk(id); item.setStatus(LegalStatus.ARCHIVED); item.setArchivedAt(Instant.now()); risks.save(item); }
            default -> throw new IllegalArgumentException("Unsupported legal record type.");
        }
        audit(actor, "LEGAL_RECORD_ARCHIVED", "Archived legal " + type + " record", "IMPORTANT");
    }

    @Transactional
    public LegalReportResponse report(LegalReportType type, AppUser actor) {
        requireViewer(actor);
        LegalSummaryResponse summary = summary(actor);
        List<LegalMetric> metrics = switch (type) {
            case CONTRACT_SUMMARY -> List.of(new LegalMetric("Active contracts", summary.activeContracts(), "neutral"), new LegalMetric("Contracts under review", summary.contractsUnderReview(), "warning"));
            case OBLIGATION_SUMMARY -> List.of(new LegalMetric("Open obligations", obligations.findAll().stream().filter(item -> item.getArchivedAt() == null && item.getStatus() != LegalStatus.ARCHIVED).count(), "neutral"));
            case RENEWAL_TRACKER -> List.of(new LegalMetric("Upcoming renewals", summary.upcomingRenewals(), "warning"), new LegalMetric("Expiring agreements", summary.expiringAgreements(), "warning"));
            case APPROVAL_SUMMARY -> List.of(new LegalMetric("Pending approvals", approvals.findAll().stream().filter(item -> item.getArchivedAt() == null && item.getApprovalStatus() == LegalStatus.PENDING_APPROVAL).count(), "warning"));
            case NOTICE_SUMMARY -> List.of(new LegalMetric("Open notices", notices.findAll().stream().filter(item -> item.getArchivedAt() == null && item.getStatus() != LegalStatus.ARCHIVED).count(), "neutral"));
            case RISK_SUMMARY -> List.of(new LegalMetric("Legal risks", summary.legalRisks(), "warning"));
        };
        audit(actor, "LEGAL_REPORT_GENERATED", "Generated legal report " + type, "INFO");
        return new LegalReportResponse(type, Instant.now(), metrics, metrics.isEmpty() ? List.of("No information has been added yet.") : List.of());
    }

    private ContractResponse toContractResponse(LegalContract item) {
        return new ContractResponse(item.getId(), item.getContractTitle(), item.getContractType(), item.getPartiesInvolved(), item.getEffectiveDate(), item.getExpiryDate(), item.getRenewalDate(), item.getContractValue(), item.getStatus(), item.getApprovalStatus(), item.getSignatureStatus(), id(item.getRelatedDocument()), docTitle(item.getRelatedDocument()), item.getResponsiblePerson(), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt());
    }

    private ObligationResponse toObligationResponse(LegalObligation item) {
        return new ObligationResponse(item.getId(), id(item.getContract()), contractTitle(item.getContract()), item.getObligationTitle(), item.getDescription(), item.getResponsiblePerson(), item.getDueDate(), item.getStatus(), item.getPriority(), id(item.getRelatedDocument()), docTitle(item.getRelatedDocument()), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt());
    }

    private LegalApprovalResponse toApprovalResponse(LegalApproval item) {
        return new LegalApprovalResponse(item.getId(), id(item.getContract()), contractTitle(item.getContract()), item.getApprovalTitle(), item.getApprovalStatus(), item.getApprover(), item.getApprovalNotes(), item.getApprovalDate(), item.getRejectionReason(), id(item.getRelatedDocument()), docTitle(item.getRelatedDocument()), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt());
    }

    private LegalNoticeResponse toNoticeResponse(LegalNotice item) {
        return new LegalNoticeResponse(item.getId(), item.getNoticeTitle(), item.getNoticeType(), item.getIssuedBy(), item.getIssuedTo(), item.getNoticeDate(), item.getResponseDueDate(), item.getStatus(), id(item.getRelatedDocument()), docTitle(item.getRelatedDocument()), item.getResponsiblePerson(), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt());
    }

    private LegalRiskResponse toRiskResponse(LegalRiskLink item) {
        return new LegalRiskResponse(item.getId(), id(item.getContract()), contractTitle(item.getContract()), id(item.getRiskRegisterEntry()), riskTitle(item.getRiskRegisterEntry()), item.getRiskTitle(), item.getSeverity(), item.getStatus(), item.getOwner(), item.getMitigationPlan(), item.getReviewDate(), item.getNotes(), item.getCreatedBy(), item.getCreatedAt(), item.getUpdatedAt(), item.getArchivedAt());
    }

    private LegalContract findContract(UUID id) { return contracts.findById(id).orElseThrow(() -> new NotFoundException("Legal contract not found.")); }
    private LegalContract findContractOrNull(UUID id) { return id == null ? null : findContract(id); }
    private LegalObligation findObligation(UUID id) { return obligations.findById(id).orElseThrow(() -> new NotFoundException("Legal obligation not found.")); }
    private LegalApproval findApproval(UUID id) { return approvals.findById(id).orElseThrow(() -> new NotFoundException("Legal approval not found.")); }
    private LegalNotice findNotice(UUID id) { return notices.findById(id).orElseThrow(() -> new NotFoundException("Legal notice not found.")); }
    private LegalRiskLink findRisk(UUID id) { return risks.findById(id).orElseThrow(() -> new NotFoundException("Legal risk not found.")); }
    private DocumentRecord findDocument(UUID id) { return id == null ? null : documents.findById(id).orElseThrow(() -> new NotFoundException("Document not found.")); }
    private RiskRegisterEntry findRiskRegisterEntry(UUID id) { return id == null ? null : riskRegister.findById(id).orElseThrow(() -> new NotFoundException("Risk register entry not found.")); }

    private void notifyRenewalIfNeeded(LocalDate previousRenewal, LegalContract contract, AppUser actor) {
        if (contract.getRenewalDate() == null || contract.getStatus() == LegalStatus.ARCHIVED) return;
        if (contract.getRenewalDate().equals(previousRenewal)) return;
        notificationService.createForAudience(AnnouncementAudience.DIRECTOR, NotificationType.GENERAL, "Legal renewal tracked", contract.getContractTitle() + " renewal date is " + contract.getRenewalDate(), MODULE, contract.getId(), actor);
    }

    private boolean isUpcoming(LocalDate date, LocalDate today, LocalDate nextMonth) {
        return date != null && !date.isBefore(today) && !date.isAfter(nextMonth);
    }

    private UUID id(Object entity) { if (entity instanceof LegalContract item) return item.getId(); if (entity instanceof DocumentRecord item) return item.getId(); if (entity instanceof RiskRegisterEntry item) return item.getId(); return null; }
    private String contractTitle(LegalContract item) { return item == null ? null : item.getContractTitle(); }
    private String riskTitle(RiskRegisterEntry item) { return item == null ? null : item.getTitle(); }
    private String docTitle(DocumentRecord item) { return item == null ? null : item.getTitle(); }
    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private void requireFounder(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER); }
    private void audit(AppUser actor, String action, String description, String severity) { auditService.record(actor, MODULE, action, description, severity); }
    private BigDecimal money(BigDecimal value) { return value == null ? ZERO : value.setScale(2, RoundingMode.HALF_UP); }
    private String required(String value, String label) { if (value == null || value.isBlank()) throw new IllegalArgumentException(label + " is required."); return value.trim(); }
    private <T> T required(T value, String label) { if (value == null) throw new IllegalArgumentException(label + " is required."); return value; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private boolean matches(String query, String... values) { if (query == null || query.isBlank()) return true; String needle = query.toLowerCase(Locale.ROOT).trim(); for (String value : values) if (value != null && value.toLowerCase(Locale.ROOT).contains(needle)) return true; return false; }
}
