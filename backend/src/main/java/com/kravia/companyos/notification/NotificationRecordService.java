package com.kravia.companyos.notification;

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
public class NotificationRecordService {
    private final NotificationRecordRepository repository;
    private final AuditService auditService;

    public NotificationRecordService(NotificationRecordRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<NotificationRecordResponse> list() { return repository.findAll().stream().map(NotificationRecordResponse::from).toList(); }

    public NotificationRecordResponse get(UUID id) { return NotificationRecordResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public NotificationRecordResponse save(NotificationRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        NotificationRecord record = new NotificationRecord();
        apply(record, request);
        NotificationRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.NOTIFICATION, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return NotificationRecordResponse.from(saved);
    }

    @Transactional
    public NotificationRecordResponse update(UUID id, NotificationRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        NotificationRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        NotificationRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.NOTIFICATION, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return NotificationRecordResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        NotificationRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.NOTIFICATION, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(NotificationRecord record, NotificationRecordRequest request) {
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
