package com.kravia.companyos.risk;

import com.kravia.companyos.audit.AuditService;
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
public class RiskRegisterService {
    private static final String MODULE = "RISK_REGISTER";

    private final RiskRegisterRepository risks;
    private final PermissionService permissions;
    private final AuditService auditService;

    public RiskRegisterService(RiskRegisterRepository risks, PermissionService permissions, AuditService auditService) {
        this.risks = risks;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<RiskResponse> list(String query, RiskCategory category, RiskLevel severity, RiskStatus status, AppUser actor) {
        requireViewer(actor);
        return risks.search(normalize(query), category, severity, status).stream().map(RiskResponse::from).toList();
    }

    @Transactional
    public RiskResponse create(RiskRequest request, AppUser actor) {
        requireEditor(actor);
        RiskRegisterEntry risk = new RiskRegisterEntry();
        risk.setCreatedBy(actor.getDisplayName());
        apply(risk, request);
        RiskRegisterEntry saved = risks.saveAndFlush(risk);
        auditService.record(actor, MODULE, "RISK_CREATED", "Created risk " + saved.getTitle(), "IMPORTANT");
        return RiskResponse.from(saved);
    }

    @Transactional
    public RiskResponse update(UUID id, RiskRequest request, AppUser actor) {
        requireEditor(actor);
        RiskRegisterEntry risk = find(id);
        apply(risk, request);
        RiskRegisterEntry saved = risks.saveAndFlush(risk);
        auditService.record(actor, MODULE, "RISK_UPDATED", "Updated risk " + saved.getTitle(), "IMPORTANT");
        return RiskResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        RiskRegisterEntry risk = find(id);
        risk.setStatus(RiskStatus.ARCHIVED);
        risk.setArchivedAt(Instant.now());
        auditService.record(actor, MODULE, "RISK_ARCHIVED", "Archived risk " + risk.getTitle(), "WARNING");
    }

    private void apply(RiskRegisterEntry risk, RiskRequest request) {
        risk.setTitle(request.title().trim());
        risk.setCategory(request.category());
        risk.setDescription(blankToNull(request.description()));
        risk.setSeverity(request.severity());
        risk.setLikelihood(request.likelihood());
        risk.setOwner(blankToNull(request.owner()));
        risk.setMitigationPlan(blankToNull(request.mitigationPlan()));
        risk.setStatus(request.status());
        risk.setReviewDate(request.reviewDate());
        risk.setRelatedRecords(blankToNull(request.relatedRecords()));
    }

    private RiskRegisterEntry find(UUID id) {
        return risks.findById(id).orElseThrow(() -> new NotFoundException("Risk not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
