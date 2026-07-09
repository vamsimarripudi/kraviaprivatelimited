package com.kravia.companyos.document;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Validated
@RestController
@RequestMapping("/documents")
public class DocumentController {
    private final DocumentService service;

    public DocumentController(DocumentService service) { this.service = service; }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentResponse upload(
        @RequestParam @NotBlank String title,
        @RequestParam @NotNull DocumentCategory category,
        @RequestParam(required = false) String description,
        @RequestParam MultipartFile file,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.upload(title, category, description, file, actor);
    }

    @GetMapping
    public List<DocumentResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) DocumentCategory category,
        @RequestParam(required = false) DocumentStatus status,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(query, category, status, actor);
    }

    @GetMapping("/{id}")
    public DocumentResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        var download = service.download(id, actor);
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(download.fileType()))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(download.fileName()).build().toString())
            .body(download.bytes());
    }

    @PutMapping("/{id}")
    public DocumentResponse update(@PathVariable UUID id, @Valid @RequestBody DocumentMetadataRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) { service.archive(id, actor); }
}
