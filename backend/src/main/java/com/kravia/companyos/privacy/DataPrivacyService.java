package com.kravia.companyos.privacy;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DataPrivacyService {
    private static final String MODULE = "DATA_PRIVACY";

    private final DataPrivacyRepository records;
    private final PermissionService permissions;
    private final AuditService auditService;

    public DataPrivacyService(DataPrivacyRepository records, PermissionService permissions, AuditService auditService) {
        this.records = records;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<DataPrivacyResponse> list(String moduleName, DataClassification classification, AppUser actor) {
        requireViewer(actor);
        return records.search(normalizeModule(moduleName), classification).stream().map(DataPrivacyResponse::from).toList();
    }

    @Transactional
    public DataPrivacyResponse create(DataPrivacyRequest request, AppUser actor) {
        requireEditor(actor);
        DataPrivacyRecord record = new DataPrivacyRecord();
        record.setCreatedBy(actor.getDisplayName());
        apply(record, request);
        DataPrivacyRecord saved = records.saveAndFlush(record);
        auditService.record(actor, MODULE, "PRIVACY_RECORD_CREATED", "Created privacy classification for " + saved.getModuleName(), "IMPORTANT");
        return DataPrivacyResponse.from(saved);
    }

    @Transactional
    public DataPrivacyResponse update(UUID id, DataPrivacyRequest request, AppUser actor) {
        requireEditor(actor);
        DataPrivacyRecord record = find(id);
        apply(record, request);
        DataPrivacyRecord saved = records.saveAndFlush(record);
        auditService.record(actor, MODULE, "PRIVACY_RECORD_UPDATED", "Updated privacy classification for " + saved.getModuleName(), "IMPORTANT");
        return DataPrivacyResponse.from(saved);
    }

    @Transactional
    public DataPrivacyResponse requestExport(UUID id, AppUser actor) {
        requireEditor(actor);
        DataPrivacyRecord record = find(id);
        record.setExportRequestedAt(Instant.now());
        auditService.record(actor, MODULE, "DATA_EXPORT_REQUESTED", "Recorded data export request placeholder for " + record.getModuleName(), "INFO");
        return DataPrivacyResponse.from(record);
    }

    @Transactional
    public DataPrivacyResponse requestDeletion(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        DataPrivacyRecord record = find(id);
        record.setDeletionRequestedAt(Instant.now());
        auditService.record(actor, MODULE, "DATA_DELETION_REQUESTED", "Recorded data deletion request placeholder for " + record.getModuleName(), "WARNING");
        return DataPrivacyResponse.from(record);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        DataPrivacyRecord record = find(id);
        record.setArchivedAt(Instant.now());
        auditService.record(actor, MODULE, "PRIVACY_RECORD_ARCHIVED", "Archived privacy record " + id, "WARNING");
    }

    private void apply(DataPrivacyRecord record, DataPrivacyRequest request) {
        record.setModuleName(normalizeModule(request.moduleName()));
        record.setRecordId(request.recordId());
        record.setClassification(request.classification());
        record.setSensitiveDocument(request.sensitiveDocument());
        record.setAccessVisibility(blankToNull(request.accessVisibility()));
        record.setRetentionRule(blankToNull(request.retentionRule()));
    }

    private DataPrivacyRecord find(UUID id) {
        return records.findById(id).orElseThrow(() -> new NotFoundException("Privacy record not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalizeModule(String value) { return value == null || value.isBlank() ? null : value.trim().toUpperCase(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
