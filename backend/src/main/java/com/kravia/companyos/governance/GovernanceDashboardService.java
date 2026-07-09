package com.kravia.companyos.governance;

import com.kravia.companyos.approval.ApprovalRequestRepository;
import com.kravia.companyos.approval.ApprovalStatus;
import com.kravia.companyos.audit.AuditLog;
import com.kravia.companyos.audit.AuditLogRepository;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.evidence.EvidencePackRepository;
import com.kravia.companyos.evidence.EvidencePackStatus;
import com.kravia.companyos.privacy.DataClassification;
import com.kravia.companyos.privacy.DataPrivacyRepository;
import com.kravia.companyos.risk.RiskLevel;
import com.kravia.companyos.risk.RiskRegisterRepository;
import com.kravia.companyos.risk.RiskStatus;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GovernanceDashboardService {
    private static final Set<String> GOVERNANCE_MODULES = Set.of(
        "DATA_PRIVACY",
        "APPROVAL_GOVERNANCE",
        "RISK_REGISTER",
        "LEGAL_EVIDENCE",
        "ACCESS_REVIEW"
    );

    private final ApprovalRequestRepository approvals;
    private final RiskRegisterRepository risks;
    private final DataPrivacyRepository privacyRecords;
    private final EvidencePackRepository evidencePacks;
    private final AccessReviewRepository accessReviews;
    private final UserRepository users;
    private final AuditLogRepository auditLogs;
    private final AccessReviewService accessReviewService;
    private final PermissionService permissions;

    public GovernanceDashboardService(
        ApprovalRequestRepository approvals,
        RiskRegisterRepository risks,
        DataPrivacyRepository privacyRecords,
        EvidencePackRepository evidencePacks,
        AccessReviewRepository accessReviews,
        UserRepository users,
        AuditLogRepository auditLogs,
        AccessReviewService accessReviewService,
        PermissionService permissions
    ) {
        this.approvals = approvals;
        this.risks = risks;
        this.privacyRecords = privacyRecords;
        this.evidencePacks = evidencePacks;
        this.accessReviews = accessReviews;
        this.users = users;
        this.auditLogs = auditLogs;
        this.accessReviewService = accessReviewService;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public GovernanceDashboardResponse dashboard(AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        String quarter = accessReviewService.currentQuarter();
        long userCount = users.count();
        long reviewed = accessReviews.findByQuarterLabel(quarter).stream()
            .filter(review -> review.getReviewStatus() != AccessReviewStatus.PENDING_REVIEW)
            .count();
        long inactiveUsers = users.findAll().stream().filter(accessReviewService::isInactive).count();
        long generatedEvidencePacks = evidencePacks.countByStatusAndArchivedAtIsNull(EvidencePackStatus.GENERATED);

        List<GovernanceDashboardResponse.GovernanceMetric> metrics = List.of(
            new GovernanceDashboardResponse.GovernanceMetric("Pending approvals", approvals.countByStatusAndArchivedAtIsNull(ApprovalStatus.PENDING_APPROVAL)),
            new GovernanceDashboardResponse.GovernanceMetric("High-risk items", risks.countBySeverityAndArchivedAtIsNull(RiskLevel.HIGH) + risks.countBySeverityAndArchivedAtIsNull(RiskLevel.CRITICAL)),
            new GovernanceDashboardResponse.GovernanceMetric("Restricted records", privacyRecords.countByClassificationAndArchivedAtIsNull(DataClassification.RESTRICTED)),
            new GovernanceDashboardResponse.GovernanceMetric("Sensitive documents", privacyRecords.countBySensitiveDocumentTrueAndArchivedAtIsNull()),
            new GovernanceDashboardResponse.GovernanceMetric("Inactive users", inactiveUsers),
            new GovernanceDashboardResponse.GovernanceMetric("Generated evidence packs", generatedEvidencePacks),
            new GovernanceDashboardResponse.GovernanceMetric("Open risks", risks.countByStatusAndArchivedAtIsNull(RiskStatus.OPEN))
        );

        return new GovernanceDashboardResponse(
            metrics,
            recentGovernanceActivity(),
            quarter,
            userCount == 0 ? "No users available for review." : reviewed + " of " + userCount + " user access record(s) reviewed.",
            generatedEvidencePacks == 0 ? "No evidence packs have been generated yet." : generatedEvidencePacks + " evidence pack(s) generated."
        );
    }

    private List<GovernanceDashboardResponse.GovernanceActivityItem> recentGovernanceActivity() {
        return auditLogs.findAll().stream()
            .filter(log -> GOVERNANCE_MODULES.contains(log.getModule()))
            .sorted(Comparator.comparing(AuditLog::getCreatedAt).reversed())
            .limit(10)
            .map(log -> new GovernanceDashboardResponse.GovernanceActivityItem(log.getId(), log.getModule(), log.getAction(), log.getDescription(), log.getActorName(), log.getCreatedAt()))
            .toList();
    }
}

