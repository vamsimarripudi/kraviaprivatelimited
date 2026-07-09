package com.kravia.companyos.document;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {
    private static final String MODULE = "DOCUMENT_VAULT";

    private final DocumentRepository documents;
    private final DocumentVersionRepository versions;
    private final DocumentStorageService storage;
    private final PermissionService permissions;
    private final AuditService auditService;
    private final long maxFileSizeBytes;
    private final Set<String> allowedContentTypes;

    public DocumentService(
        DocumentRepository documents,
        DocumentVersionRepository versions,
        DocumentStorageService storage,
        PermissionService permissions,
        AuditService auditService,
        @Value("${kravia.documents.max-file-size-bytes}") long maxFileSizeBytes,
        @Value("${kravia.documents.allowed-content-types}") String allowedContentTypes
    ) {
        this.documents = documents;
        this.versions = versions;
        this.storage = storage;
        this.permissions = permissions;
        this.auditService = auditService;
        this.maxFileSizeBytes = maxFileSizeBytes;
        this.allowedContentTypes = Arrays.stream(allowedContentTypes.split(","))
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .collect(Collectors.toUnmodifiableSet());
    }

    public List<DocumentResponse> list(String query, DocumentCategory category, DocumentStatus status, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        return documents.search(normalizeQuery(query), category, status).stream().map(DocumentResponse::from).toList();
    }

    public DocumentResponse get(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        return DocumentResponse.from(find(id));
    }

    @Transactional
    public DocumentResponse upload(String title, DocumentCategory category, String description, MultipartFile file, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
        validateTitle(title);
        if (category == null) throw new IllegalArgumentException("Document category is required.");
        validateFile(file);

        DocumentStorageService.StoredDocument stored = store(file);
        DocumentRecord document = new DocumentRecord();
        document.setTitle(title.trim());
        document.setCategory(category);
        document.setDescription(blankToNull(description));
        document.setStatus(DocumentStatus.ACTIVE);
        document.setFileName(stored.safeFileName());
        document.setFileType(file.getContentType());
        document.setFileSize(file.getSize());
        document.setStoragePath(stored.storagePath());
        document.setVersion(1);
        document.setUploadedBy(actor.getDisplayName());
        DocumentRecord saved = documents.save(document);
        versions.save(versionFrom(saved, actor));
        auditService.record(actor, MODULE, "DOCUMENT_UPLOADED", "Uploaded document " + saved.getTitle(), "IMPORTANT");
        return DocumentResponse.from(saved);
    }

    @Transactional
    public DocumentResponse update(UUID id, DocumentMetadataRequest request, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
        DocumentRecord document = find(id);
        if (document.getStatus() == DocumentStatus.ARCHIVED) throw new ForbiddenOperationException("Archived documents cannot be edited.");
        if (request.status() == DocumentStatus.ARCHIVED) {
            permissions.requireAnyRole(actor, Role.FOUNDER);
            document.setArchivedAt(Instant.now());
        }
        document.setTitle(request.title().trim());
        document.setCategory(request.category());
        document.setDescription(blankToNull(request.description()));
        document.setStatus(request.status());
        DocumentRecord saved = documents.save(document);
        auditService.record(actor, MODULE, "DOCUMENT_UPDATED", "Updated document metadata " + saved.getTitle(), "IMPORTANT");
        return DocumentResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        DocumentRecord document = find(id);
        if (document.getStatus() != DocumentStatus.ARCHIVED) {
            document.setStatus(DocumentStatus.ARCHIVED);
            document.setArchivedAt(Instant.now());
        }
        auditService.record(actor, MODULE, "DOCUMENT_ARCHIVED", "Archived document " + document.getTitle(), "WARNING");
    }

    @Transactional
    public DownloadedDocument download(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        DocumentRecord document = find(id);
        var resource = loadStoredDocument(document);
        auditService.record(actor, MODULE, "DOCUMENT_DOWNLOADED", "Downloaded document " + document.getTitle(), "INFO");
        return new DownloadedDocument(document.getFileName(), document.getFileType(), resource.bytes());
    }

    private DocumentStorageService.StoredDocument store(MultipartFile file) {
        try {
            return storage.store(file.getOriginalFilename(), file.getInputStream());
        } catch (IOException exception) {
            throw new IllegalArgumentException("Document file could not be stored.");
        }
    }

    private DocumentStorageService.StoredDocumentResource loadStoredDocument(DocumentRecord document) {
        try {
            return storage.load(document.getStoragePath());
        } catch (IOException exception) {
            throw new NotFoundException("Document file was not found.");
        }
    }

    private DocumentRecord find(UUID id) {
        return documents.findById(id).orElseThrow(() -> new NotFoundException("Document not found."));
    }

    private DocumentVersion versionFrom(DocumentRecord document, AppUser actor) {
        DocumentVersion version = new DocumentVersion();
        version.setDocument(document);
        version.setVersion(document.getVersion());
        version.setFileName(document.getFileName());
        version.setFileType(document.getFileType());
        version.setFileSize(document.getFileSize());
        version.setStoragePath(document.getStoragePath());
        version.setUploadedBy(actor.getDisplayName());
        return version;
    }

    private void validateTitle(String title) {
        if (title == null || title.isBlank()) throw new IllegalArgumentException("Document title is required.");
        if (title.length() > 255) throw new IllegalArgumentException("Document title must be 255 characters or fewer.");
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new IllegalArgumentException("Document file is required.");
        if (file.getSize() > maxFileSizeBytes) throw new IllegalArgumentException("Document file exceeds the configured size limit.");
        String contentType = file.getContentType();
        if (contentType == null || !allowedContentTypes.contains(contentType)) {
            throw new IllegalArgumentException("Document file type is not allowed.");
        }
    }

    private String normalizeQuery(String query) { return query == null ? null : query.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    public record DownloadedDocument(String fileName, String fileType, byte[] bytes) {}
}
