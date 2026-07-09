package com.kravia.companyos.setting;

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
public class SettingEntryService {
    private final SettingEntryRepository repository;
    private final AuditService auditService;

    public SettingEntryService(SettingEntryRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<SettingEntryResponse> list() { return repository.findAll().stream().map(SettingEntryResponse::from).toList(); }

    public SettingEntryResponse get(UUID id) { return SettingEntryResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public SettingEntryResponse save(SettingEntryRequest request, AppUser actor) {
        ensureWrite(actor);
        SettingEntry record = new SettingEntry();
        apply(record, request);
        SettingEntry saved = repository.save(record);
        auditService.record(actor, ModuleType.SETTING, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return SettingEntryResponse.from(saved);
    }

    @Transactional
    public SettingEntryResponse update(UUID id, SettingEntryRequest request, AppUser actor) {
        ensureWrite(actor);
        SettingEntry record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        SettingEntry saved = repository.save(record);
        auditService.record(actor, ModuleType.SETTING, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return SettingEntryResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        SettingEntry record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.SETTING, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(SettingEntry record, SettingEntryRequest request) {
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
        if (true && actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can modify this module.");
    }
}
