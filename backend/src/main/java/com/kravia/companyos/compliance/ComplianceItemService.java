package com.kravia.companyos.compliance;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ComplianceItemService {
    private static final String MODULE = "COMPLIANCE_CENTER";
    private static final Set<ComplianceStatus> ACTIVE_STATUSES = Set.of(
        ComplianceStatus.NOT_STARTED,
        ComplianceStatus.IN_PROGRESS,
        ComplianceStatus.WAITING_FOR_CA,
        ComplianceStatus.WAITING_FOR_DIRECTOR,
        ComplianceStatus.SUBMITTED,
        ComplianceStatus.REJECTED
    );

    private final ComplianceItemRepository items;
    private final PermissionService permissions;
    private final AuditService auditService;

    public ComplianceItemService(ComplianceItemRepository items, PermissionService permissions, AuditService auditService) {
        this.items = items;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ComplianceItemResponse> list(String query, ComplianceCategory category, ComplianceStatus status, CompliancePriority priority, AppUser actor) {
        requireViewer(actor);
        return items.search(normalizeQuery(query), category, status, priority).stream().map(ComplianceItemResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ComplianceItemResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return ComplianceItemResponse.from(find(id));
    }

    @Transactional
    public ComplianceItemResponse create(ComplianceItemRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        ComplianceItem item = new ComplianceItem();
        item.setCreatedBy(actor.getDisplayName());
        apply(item, request);
        ComplianceItem saved = items.saveAndFlush(item);
        auditService.record(actor, MODULE, "COMPLIANCE_ITEM_CREATED", "Created compliance item " + saved.getTitle(), "IMPORTANT");
        return ComplianceItemResponse.from(saved);
    }

    @Transactional
    public ComplianceItemResponse update(UUID id, ComplianceItemRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        ComplianceItem item = find(id);
        ensureEditable(item);
        ComplianceStatus previousStatus = item.getStatus();
        if (request.status() == ComplianceStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        apply(item, request);
        if (item.getStatus() == ComplianceStatus.ARCHIVED) item.setArchivedAt(Instant.now());
        ComplianceItem saved = items.saveAndFlush(item);
        auditService.record(actor, MODULE, "COMPLIANCE_ITEM_UPDATED", "Updated compliance item " + saved.getTitle(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        return ComplianceItemResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        ComplianceItem item = find(id);
        ComplianceStatus previousStatus = item.getStatus();
        if (item.getStatus() != ComplianceStatus.ARCHIVED) {
            item.setStatus(ComplianceStatus.ARCHIVED);
            item.setArchivedAt(Instant.now());
        }
        auditStatusChange(actor, item, previousStatus, item.getStatus());
        auditService.record(actor, MODULE, "COMPLIANCE_ITEM_ARCHIVED", "Archived compliance item " + item.getTitle(), "WARNING");
    }

    private void apply(ComplianceItem item, ComplianceItemRequest request) {
        item.setTitle(request.title().trim());
        item.setCategory(request.category());
        item.setDescription(blankToNull(request.description()));
        item.setDueDate(request.dueDate());
        item.setStatus(request.status());
        item.setPriority(request.priority());
        item.setResponsiblePerson(blankToNull(request.responsiblePerson()));
        item.setRelatedDocumentId(request.relatedDocumentId());
        item.setNotes(blankToNull(request.notes()));
    }

    private void validateRequest(ComplianceItemRequest request) {
        if (request.title() == null || request.title().isBlank()) throw new IllegalArgumentException("Compliance title is required.");
        if (request.category() == null) throw new IllegalArgumentException("Compliance category is required.");
        if (request.status() == null) throw new IllegalArgumentException("Compliance status is required.");
        if (request.priority() == null) throw new IllegalArgumentException("Compliance priority is required.");
        if (request.status() != ComplianceStatus.NOT_APPLICABLE && request.dueDate() == null) {
            throw new IllegalArgumentException("Due date is required unless compliance item is not applicable.");
        }
        if (ACTIVE_STATUSES.contains(request.status()) && (request.responsiblePerson() == null || request.responsiblePerson().isBlank())) {
            throw new IllegalArgumentException("Responsible person is required for active compliance items.");
        }
    }

    private void ensureEditable(ComplianceItem item) {
        if (item.getStatus() == ComplianceStatus.ARCHIVED) throw new ForbiddenOperationException("Archived compliance items cannot be edited.");
    }

    private void auditStatusChange(AppUser actor, ComplianceItem item, ComplianceStatus previousStatus, ComplianceStatus newStatus) {
        if (previousStatus != newStatus) {
            auditService.record(actor, MODULE, "COMPLIANCE_STATUS_CHANGED", "Changed compliance status from " + previousStatus + " to " + newStatus + " for " + item.getTitle(), "INFO");
        }
    }

    private ComplianceItem find(UUID id) {
        return items.findById(id).orElseThrow(() -> new NotFoundException("Compliance item not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalizeQuery(String query) { return query == null ? null : query.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
