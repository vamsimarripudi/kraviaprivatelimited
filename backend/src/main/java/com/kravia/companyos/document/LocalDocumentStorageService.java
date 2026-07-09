package com.kravia.companyos.document;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class LocalDocumentStorageService implements DocumentStorageService {
    private final Path root;

    public LocalDocumentStorageService(@Value("${kravia.storage.local-root}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @Override
    public StoredDocument store(String originalFilename, InputStream inputStream) throws IOException {
        Files.createDirectories(root);
        String cleanName = StringUtils.cleanPath(originalFilename == null ? "document" : originalFilename).replaceAll("[^a-zA-Z0-9._-]", "_");
        String storageKey = UUID.randomUUID() + "-" + cleanName;
        Path target = root.resolve(storageKey).normalize();
        if (!target.startsWith(root)) throw new IOException("Invalid storage path.");
        long size = Files.copy(inputStream, target);
        return new StoredDocument(storageKey, size);
    }

    @Override
    public StoredDocumentResource load(String storageKey) throws IOException {
        Path target = root.resolve(storageKey).normalize();
        if (!target.startsWith(root) || !Files.exists(target)) throw new IOException("Document not found.");
        return new StoredDocumentResource(target.getFileName().toString(), Files.readAllBytes(target));
    }
}
