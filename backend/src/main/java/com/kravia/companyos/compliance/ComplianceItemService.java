package com.kravia.companyos.compliance;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.ModuleType;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.user.AppUser;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ComplianceItemService {
    private final ComplianceItemRepository repository;
    private final AuditService auditService;

    public ComplianceItemService(ComplianceItemRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<ComplianceItemResponse> list() { return repository.findAll().stream().map(ComplianceItemResponse::from).toList(); }

    public ComplianceItemResponse get(UUID id) { return ComplianceItemResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public ComplianceItemResponse save(ComplianceItemRequest request, AppUser actor) {
        ensureWrite(actor);
        ComplianceItem record = new ComplianceItem();
        apply(record, request);
        ComplianceItem saved = repository.save(record);
        auditService.record(actor, ModuleType.COMPLIANCE, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return ComplianceItemResponse.from(saved);
    }

    @Transactional
    public ComplianceItemResponse update(UUID id, ComplianceItemRequest request, AppUser actor) {
        ensureWrite(actor);
        ComplianceItem record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        ComplianceItem saved = repository.save(record);
        auditService.record(actor, ModuleType.COMPLIANCE, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return ComplianceItemResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        ComplianceItem record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.COMPLIANCE, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(ComplianceItem record, ComplianceItemRequest request) {
        record.setTitle(request.title());
        record.setStatus(request.status());
        record.setOwnerName(request.ownerName());
        record.setDueDate(request.dueDate());
        record.setCategory(request.category());
        record.setReferenceCode(request.referenceCode());
        record.setAmount(request.amount());
        record.setDetails(request.details());
        record.setNotes(request.notes());
    }

    private void ensureWrite(AppUser actor) {
        if (actor.getRole() == Role.VIEWER) throw new ForbiddenOperationException("Viewer role is read-only.");
        if (false && actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can modify this module.");
    }
}
