package com.kravia.companyos.task;

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
public class CompanyTaskService {
    private final CompanyTaskRepository repository;
    private final AuditService auditService;

    public CompanyTaskService(CompanyTaskRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<CompanyTaskResponse> list() { return repository.findAll().stream().map(CompanyTaskResponse::from).toList(); }

    public CompanyTaskResponse get(UUID id) { return CompanyTaskResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public CompanyTaskResponse save(CompanyTaskRequest request, AppUser actor) {
        ensureWrite(actor);
        CompanyTask record = new CompanyTask();
        apply(record, request);
        CompanyTask saved = repository.save(record);
        auditService.record(actor, ModuleType.TASK, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return CompanyTaskResponse.from(saved);
    }

    @Transactional
    public CompanyTaskResponse update(UUID id, CompanyTaskRequest request, AppUser actor) {
        ensureWrite(actor);
        CompanyTask record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        CompanyTask saved = repository.save(record);
        auditService.record(actor, ModuleType.TASK, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return CompanyTaskResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        CompanyTask record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.TASK, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(CompanyTask record, CompanyTaskRequest request) {
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
