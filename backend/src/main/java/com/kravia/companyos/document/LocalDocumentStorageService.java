package com.kravia.companyos.document;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class LocalDocumentStorageService implements DocumentStorageService {
    private final Path root;

    public LocalDocumentStorageService(@Value("${kravia.documents.storage-root}") String root) {
        this.root = Path.of(root).toAbsolutePath().normalize();
    }

    @Override
    public StoredDocument store(String originalFilename, InputStream inputStream) throws IOException {
        String safeName = safeFileName(originalFilename);
        Files.createDirectories(root);
        String storageKey = UUID.randomUUID() + "-" + safeName;
        Path target = root.resolve(storageKey).normalize();
        if (!target.startsWith(root)) throw new IOException("Invalid document storage path.");
        Files.copy(inputStream, target, StandardCopyOption.REPLACE_EXISTING);
        return new StoredDocument(storageKey, safeName);
    }

    @Override
    public StoredDocumentResource load(String storagePath) throws IOException {
        if (storagePath == null || storagePath.isBlank() || storagePath.contains("..") || storagePath.contains("/") || storagePath.contains("\\")) {
            throw new IOException("Invalid document storage key.");
        }
        Path target = root.resolve(storagePath).normalize();
        if (!target.startsWith(root) || !Files.exists(target) || !Files.isRegularFile(target)) {
            throw new IOException("Document file was not found.");
        }
        return new StoredDocumentResource(target.getFileName().toString(), Files.readAllBytes(target));
    }

    private String safeFileName(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) throw new IllegalArgumentException("File name is required.");
        if (originalFilename.contains("..") || originalFilename.contains("/") || originalFilename.contains("\\")) {
            throw new IllegalArgumentException("Unsafe file name was rejected.");
        }
        String cleanName = StringUtils.cleanPath(originalFilename).trim();
        if (!cleanName.equals(originalFilename.trim())) throw new IllegalArgumentException("Unsafe file name was rejected.");
        String safeName = cleanName.replaceAll("[^a-zA-Z0-9._ -]", "_");
        if (safeName.isBlank() || safeName.contains("..")) throw new IllegalArgumentException("Unsafe file name was rejected.");
        return safeName;
    }
}
