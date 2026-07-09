package com.kravia.companyos.approval;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ApprovalService {
    private static final String MODULE = "APPROVAL_GOVERNANCE";

    private final ApprovalRequestRepository approvals;
    private final PermissionService permissions;
    private final AuditService auditService;

    public ApprovalService(ApprovalRequestRepository approvals, PermissionService permissions, AuditService auditService) {
        this.approvals = approvals;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ApprovalResponse> list(String query, ApprovalStatus status, String linkedModule, AppUser actor) {
        requireViewer(actor);
        return approvals.search(normalize(query), status, normalizeModule(linkedModule)).stream().map(ApprovalResponse::from).toList();
    }

    @Transactional
    public ApprovalResponse create(ApprovalRequestDto request, AppUser actor) {
        requireEditor(actor);
        ApprovalRequestEntity approval = new ApprovalRequestEntity();
        approval.setCreatedBy(actor.getDisplayName());
        apply(approval, request);
        ApprovalRequestEntity saved = approvals.saveAndFlush(approval);
        auditService.record(actor, MODULE, "APPROVAL_CREATED", "Created approval request " + saved.getTitle(), "IMPORTANT");
        return ApprovalResponse.from(saved);
    }

    @Transactional
    public ApprovalResponse update(UUID id, ApprovalRequestDto request, AppUser actor) {
        requireEditor(actor);
        ApprovalRequestEntity approval = find(id);
        if (approval.getStatus() == ApprovalStatus.APPROVED) throw new ForbiddenOperationException("Approved requests cannot be edited.");
        apply(approval, request);
        ApprovalRequestEntity saved = approvals.saveAndFlush(approval);
        auditService.record(actor, MODULE, "APPROVAL_UPDATED", "Updated approval request " + saved.getTitle(), "IMPORTANT");
        return ApprovalResponse.from(saved);
    }

    @Transactional
    public ApprovalResponse decide(UUID id, ApprovalDecisionRequest request, AppUser actor) {
        requireEditor(actor);
        ApprovalRequestEntity approval = find(id);
        if (request.status() == ApprovalStatus.APPROVED) {
            approval.setApprovalDate(Instant.now());
            approval.setApprover(actor.getDisplayName());
            approval.setRejectionReason(null);
        } else if (request.status() == ApprovalStatus.REJECTED && (request.rejectionReason() == null || request.rejectionReason().isBlank())) {
            throw new IllegalArgumentException("Rejection reason is required when rejecting approval.");
        }
        approval.setStatus(request.status());
        approval.setApprovalNotes(blankToNull(request.approvalNotes()));
        approval.setRejectionReason(blankToNull(request.rejectionReason()));
        ApprovalRequestEntity saved = approvals.saveAndFlush(approval);
        auditService.record(actor, MODULE, "APPROVAL_DECISION_RECORDED", "Recorded approval decision " + saved.getStatus() + " for " + saved.getTitle(), "IMPORTANT");
        return ApprovalResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        ApprovalRequestEntity approval = find(id);
        approval.setArchivedAt(Instant.now());
        auditService.record(actor, MODULE, "APPROVAL_ARCHIVED", "Archived approval request " + approval.getTitle(), "WARNING");
    }

    private void apply(ApprovalRequestEntity approval, ApprovalRequestDto request) {
        approval.setTitle(request.title().trim());
        approval.setDescription(blankToNull(request.description()));
        approval.setStatus(request.status());
        approval.setApprover(blankToNull(request.approver()));
        approval.setApprovalNotes(blankToNull(request.approvalNotes()));
        approval.setRejectionReason(blankToNull(request.rejectionReason()));
        approval.setLinkedModule(normalizeModule(request.linkedModule()));
        approval.setLinkedRecordId(request.linkedRecordId());
        if (request.status() == ApprovalStatus.APPROVED && approval.getApprovalDate() == null) approval.setApprovalDate(Instant.now());
    }

    private ApprovalRequestEntity find(UUID id) {
        return approvals.findById(id).orElseThrow(() -> new NotFoundException("Approval request not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String normalizeModule(String value) { return value == null || value.isBlank() ? null : value.trim().toUpperCase(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
