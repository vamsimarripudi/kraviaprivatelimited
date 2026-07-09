package com.kravia.companyos.report;

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
public class ReportRecordService {
    private final ReportRecordRepository repository;
    private final AuditService auditService;

    public ReportRecordService(ReportRecordRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<ReportRecordResponse> list() { return repository.findAll().stream().map(ReportRecordResponse::from).toList(); }

    public ReportRecordResponse get(UUID id) { return ReportRecordResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public ReportRecordResponse save(ReportRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        ReportRecord record = new ReportRecord();
        apply(record, request);
        ReportRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.REPORT, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return ReportRecordResponse.from(saved);
    }

    @Transactional
    public ReportRecordResponse update(UUID id, ReportRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        ReportRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        ReportRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.REPORT, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return ReportRecordResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        ReportRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.REPORT, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(ReportRecord record, ReportRecordRequest request) {
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
