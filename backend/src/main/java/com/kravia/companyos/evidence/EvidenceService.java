package com.kravia.companyos.evidence;

import com.kravia.companyos.audit.AuditLog;
import com.kravia.companyos.audit.AuditLogRepository;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.document.DocumentRepository;
import com.kravia.companyos.document.DocumentVersion;
import com.kravia.companyos.document.DocumentVersionRepository;
import com.kravia.companyos.finance.FinancialRecordRepository;
import com.kravia.companyos.meeting.BoardMeetingRepository;
import com.kravia.companyos.compliance.ComplianceItemRepository;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EvidenceService {
    private static final String MODULE = "LEGAL_EVIDENCE";

    private final EvidencePackRepository evidencePacks;
    private final AuditLogRepository auditLogs;
    private final DocumentVersionRepository documentVersions;
    private final BoardMeetingRepository boardMeetings;
    private final ComplianceItemRepository complianceItems;
    private final FinancialRecordRepository financialRecords;
    private final DocumentRepository documents;
    private final UserRepository users;
    private final PermissionService permissions;
    private final AuditService auditService;

    public EvidenceService(
        EvidencePackRepository evidencePacks,
        AuditLogRepository auditLogs,
        DocumentVersionRepository documentVersions,
        BoardMeetingRepository boardMeetings,
        ComplianceItemRepository complianceItems,
        FinancialRecordRepository financialRecords,
        DocumentRepository documents,
        UserRepository users,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.evidencePacks = evidencePacks;
        this.auditLogs = auditLogs;
        this.documentVersions = documentVersions;
        this.boardMeetings = boardMeetings;
        this.complianceItems = complianceItems;
        this.financialRecords = financialRecords;
        this.documents = documents;
        this.users = users;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<EvidencePackResponse> listPacks(AppUser actor) {
        requireViewer(actor);
        return evidencePacks.findByArchivedAtIsNullOrderByGeneratedAtDesc().stream().map(EvidencePackResponse::from).toList();
    }

    @Transactional
    public EvidencePackResponse generate(EvidencePackRequest request, AppUser actor) {
        requireEditor(actor);
        EvidencePack pack = new EvidencePack();
        pack.setPackType(request.packType());
        pack.setTitle(request.title() == null || request.title().isBlank() ? defaultTitle(request.packType()) : request.title().trim());
        pack.setStatus(EvidencePackStatus.GENERATED);
        pack.setSourceSummary(sourceSummary(request.packType()));
        pack.setGeneratedBy(actor.getDisplayName());
        pack.setGeneratedAt(Instant.now());
        pack.setPdfExportAvailable(false);
        pack.setZipExportAvailable(false);
        pack.setExcelExportAvailable(false);
        EvidencePack saved = evidencePacks.saveAndFlush(pack);
        auditService.record(actor, MODULE, "EVIDENCE_PACK_GENERATED", "Generated evidence pack " + saved.getTitle(), "IMPORTANT");
        return EvidencePackResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<EvidenceTimelineItem> timeline(AppUser actor) {
        requireViewer(actor);
        Stream<EvidenceTimelineItem> auditItems = auditLogs.findAll().stream().map(this::fromAudit);
        Stream<EvidenceTimelineItem> versionItems = documentVersions.findAll().stream().map(this::fromDocumentVersion);
        return Stream.concat(auditItems, versionItems)
            .sorted((left, right) -> {
                if (left.timestamp() == null && right.timestamp() == null) return 0;
                if (left.timestamp() == null) return 1;
                if (right.timestamp() == null) return -1;
                return right.timestamp().compareTo(left.timestamp());
            })
            .limit(100)
            .toList();
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        EvidencePack pack = evidencePacks.findById(id).orElseThrow(() -> new NotFoundException("Evidence pack not found."));
        pack.setStatus(EvidencePackStatus.ARCHIVED);
        pack.setArchivedAt(Instant.now());
        auditService.record(actor, MODULE, "EVIDENCE_PACK_ARCHIVED", "Archived evidence pack " + pack.getTitle(), "WARNING");
    }

    private EvidenceTimelineItem fromAudit(AuditLog log) {
        return new EvidenceTimelineItem(log.getId(), "AUDIT_LOG", log.getModule(), log.getAction(), log.getActorName(), log.getDescription(), log.getCreatedAt());
    }

    private EvidenceTimelineItem fromDocumentVersion(DocumentVersion version) {
        return new EvidenceTimelineItem(
            version.getId(),
            "DOCUMENT_VERSION",
            "DOCUMENTS",
            "DOCUMENT_VERSION_RECORDED",
            version.getUploadedBy(),
            "Document version " + version.getVersion() + " recorded for " + version.getFileName(),
            version.getCreatedAt()
        );
    }

    private String sourceSummary(EvidencePackType type) {
        return switch (type) {
            case BOARD_MEETINGS -> boardMeetings.count() + " board meeting record(s) available.";
            case COMPLIANCE_FILINGS -> complianceItems.count() + " compliance item(s) available.";
            case FINANCIAL_RECORDS -> financialRecords.count() + " financial record(s) available.";
            case DOCUMENT_VAULT -> documents.count() + " document metadata record(s) available.";
            case USER_ACCESS -> users.count() + " user access record(s) available.";
            case AUDIT_LOGS -> auditLogs.count() + " audit log record(s) available.";
        };
    }

    private String defaultTitle(EvidencePackType type) {
        return switch (type) {
            case BOARD_MEETINGS -> "Board Meeting Evidence Pack";
            case COMPLIANCE_FILINGS -> "Compliance Filing Evidence Pack";
            case FINANCIAL_RECORDS -> "Financial Records Evidence Pack";
            case DOCUMENT_VAULT -> "Document Vault Evidence Pack";
            case USER_ACCESS -> "User Access Evidence Pack";
            case AUDIT_LOGS -> "Audit Log Evidence Pack";
        };
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
}
