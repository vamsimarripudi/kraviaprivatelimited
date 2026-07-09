package com.kravia.companyos.finance;

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
public class FinancialRecordService {
    private final FinancialRecordRepository repository;
    private final AuditService auditService;

    public FinancialRecordService(FinancialRecordRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<FinancialRecordResponse> list() { return repository.findAll().stream().map(FinancialRecordResponse::from).toList(); }

    public FinancialRecordResponse get(UUID id) { return FinancialRecordResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public FinancialRecordResponse save(FinancialRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        FinancialRecord record = new FinancialRecord();
        apply(record, request);
        FinancialRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.FINANCE, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return FinancialRecordResponse.from(saved);
    }

    @Transactional
    public FinancialRecordResponse update(UUID id, FinancialRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        FinancialRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        FinancialRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.FINANCE, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return FinancialRecordResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        FinancialRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.FINANCE, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(FinancialRecord record, FinancialRecordRequest request) {
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
