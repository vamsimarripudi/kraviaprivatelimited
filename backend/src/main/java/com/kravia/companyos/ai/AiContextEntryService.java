package com.kravia.companyos.ai;

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
public class AiContextEntryService {
    private final AiContextEntryRepository repository;
    private final AuditService auditService;

    public AiContextEntryService(AiContextEntryRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<AiContextEntryResponse> list() { return repository.findAll().stream().map(AiContextEntryResponse::from).toList(); }

    public AiContextEntryResponse get(UUID id) { return AiContextEntryResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public AiContextEntryResponse save(AiContextEntryRequest request, AppUser actor) {
        ensureWrite(actor);
        AiContextEntry record = new AiContextEntry();
        apply(record, request);
        AiContextEntry saved = repository.save(record);
        auditService.record(actor, ModuleType.AI_ASSISTANT, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return AiContextEntryResponse.from(saved);
    }

    @Transactional
    public AiContextEntryResponse update(UUID id, AiContextEntryRequest request, AppUser actor) {
        ensureWrite(actor);
        AiContextEntry record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        AiContextEntry saved = repository.save(record);
        auditService.record(actor, ModuleType.AI_ASSISTANT, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return AiContextEntryResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        AiContextEntry record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.AI_ASSISTANT, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(AiContextEntry record, AiContextEntryRequest request) {
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
