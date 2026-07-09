package com.kravia.companyos.contact;

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
public class ContactRecordService {
    private final ContactRecordRepository repository;
    private final AuditService auditService;

    public ContactRecordService(ContactRecordRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<ContactRecordResponse> list() { return repository.findAll().stream().map(ContactRecordResponse::from).toList(); }

    public ContactRecordResponse get(UUID id) { return ContactRecordResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public ContactRecordResponse save(ContactRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        ContactRecord record = new ContactRecord();
        apply(record, request);
        ContactRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.CONTACT, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return ContactRecordResponse.from(saved);
    }

    @Transactional
    public ContactRecordResponse update(UUID id, ContactRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        ContactRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        ContactRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.CONTACT, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return ContactRecordResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        ContactRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.CONTACT, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(ContactRecord record, ContactRecordRequest request) {
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
