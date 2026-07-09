package com.kravia.companyos.product;

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
public class ProductRecordService {
    private final ProductRecordRepository repository;
    private final AuditService auditService;

    public ProductRecordService(ProductRecordRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<ProductRecordResponse> list() { return repository.findAll().stream().map(ProductRecordResponse::from).toList(); }

    public ProductRecordResponse get(UUID id) { return ProductRecordResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public ProductRecordResponse save(ProductRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        ProductRecord record = new ProductRecord();
        apply(record, request);
        ProductRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.PRODUCT, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return ProductRecordResponse.from(saved);
    }

    @Transactional
    public ProductRecordResponse update(UUID id, ProductRecordRequest request, AppUser actor) {
        ensureWrite(actor);
        ProductRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        ProductRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.PRODUCT, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return ProductRecordResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        ProductRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.PRODUCT, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(ProductRecord record, ProductRecordRequest request) {
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
