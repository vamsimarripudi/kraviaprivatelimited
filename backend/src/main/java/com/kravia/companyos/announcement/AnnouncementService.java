package com.kravia.companyos.announcement;

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
public class AnnouncementService {
    private final AnnouncementRepository repository;
    private final AuditService auditService;

    public AnnouncementService(AnnouncementRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<AnnouncementResponse> list() { return repository.findAll().stream().map(AnnouncementResponse::from).toList(); }

    public AnnouncementResponse get(UUID id) { return AnnouncementResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public AnnouncementResponse save(AnnouncementRequest request, AppUser actor) {
        ensureWrite(actor);
        Announcement record = new Announcement();
        apply(record, request);
        Announcement saved = repository.save(record);
        auditService.record(actor, ModuleType.ANNOUNCEMENT, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return AnnouncementResponse.from(saved);
    }

    @Transactional
    public AnnouncementResponse update(UUID id, AnnouncementRequest request, AppUser actor) {
        ensureWrite(actor);
        Announcement record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        Announcement saved = repository.save(record);
        auditService.record(actor, ModuleType.ANNOUNCEMENT, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return AnnouncementResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        Announcement record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.ANNOUNCEMENT, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(Announcement record, AnnouncementRequest request) {
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
