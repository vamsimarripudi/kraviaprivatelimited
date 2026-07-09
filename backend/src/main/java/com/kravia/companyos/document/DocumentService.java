package com.kravia.companyos.document;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ModuleType;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {
    private final DocumentRepository repository;
    private final DocumentStorageService storage;
    private final AuditService auditService;
    private final PermissionService permissions;

    public DocumentService(DocumentRepository repository, DocumentStorageService storage, AuditService auditService, PermissionService permissions) {
        this.repository = repository;
        this.storage = storage;
        this.auditService = auditService;
        this.permissions = permissions;
    }

    public List<DocumentResponse> list() { return repository.findAll().stream().map(DocumentResponse::from).toList(); }

    @Transactional
    public DocumentResponse upload(String title, String category, MultipartFile file, AppUser actor) throws IOException {
        permissions.requireFounder(actor, "Only founders can upload documents.");
        if (title == null || title.isBlank()) throw new IllegalArgumentException("Document title is required.");
        if (category == null || category.isBlank()) throw new IllegalArgumentException("Document category is required.");
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Document file is required.");
        var stored = storage.store(file.getOriginalFilename(), file.getInputStream());
        DocumentRecord record = new DocumentRecord();
        record.setTitle(title.trim());
        record.setCategory(category.trim());
        record.setContentType(file.getContentType());
        record.setSizeBytes(stored.sizeBytes());
        record.setStorageKey(stored.storageKey());
        record.setUploadedBy(actor.getDisplayName());
        DocumentRecord saved = repository.save(record);
        auditService.record(actor, ModuleType.DOCUMENT_VAULT, "DOCUMENT_UPLOADED", "Uploaded document " + saved.getTitle(), "IMPORTANT");
        return DocumentResponse.from(saved);
    }

    public DocumentStorageService.StoredDocumentResource download(UUID id) throws IOException {
        DocumentRecord record = repository.findById(id).orElseThrow(() -> new NotFoundException("Document not found."));
        return storage.load(record.getStorageKey());
    }
}
