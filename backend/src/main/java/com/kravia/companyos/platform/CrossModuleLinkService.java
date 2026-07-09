package com.kravia.companyos.platform;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CrossModuleLinkService {
    private static final String MODULE = "ERP_RELATIONSHIPS";

    private final CrossModuleLinkRepository links;
    private final PermissionService permissions;
    private final AuditService auditService;

    public CrossModuleLinkService(CrossModuleLinkRepository links, PermissionService permissions, AuditService auditService) {
        this.links = links;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<CrossModuleLinkResponse> list(String module, UUID recordId, AppUser actor) {
        requireViewer(actor);
        return links.findRelated(normalizeModule(module), recordId).stream().map(CrossModuleLinkResponse::from).toList();
    }

    @Transactional
    public CrossModuleLinkResponse create(CrossModuleLinkRequest request, AppUser actor) {
        requireEditor(actor);
        CrossModuleLink link = new CrossModuleLink();
        link.setSourceModule(normalizeModule(request.sourceModule()));
        link.setSourceRecordId(request.sourceRecordId());
        link.setTargetModule(normalizeModule(request.targetModule()));
        link.setTargetRecordId(request.targetRecordId());
        link.setRelationshipType(normalizeModule(request.relationshipType()));
        link.setLabel(blankToNull(request.label()));
        CrossModuleLink saved = links.saveAndFlush(link);
        auditService.record(actor, MODULE, "RELATIONSHIP_CREATED", "Linked " + saved.getSourceModule() + " to " + saved.getTargetModule(), "INFO");
        return CrossModuleLinkResponse.from(saved);
    }

    @Transactional
    public void delete(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        CrossModuleLink link = links.findById(id).orElseThrow(() -> new NotFoundException("Relationship not found."));
        links.delete(link);
        auditService.record(actor, MODULE, "RELATIONSHIP_DELETED", "Removed cross-module relationship " + id, "WARNING");
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalizeModule(String value) { return value == null || value.isBlank() ? null : value.trim().toUpperCase(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
