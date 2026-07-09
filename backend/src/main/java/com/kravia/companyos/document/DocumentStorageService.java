package com.kravia.companyos.document;

import java.io.IOException;
import java.io.InputStream;

public interface DocumentStorageService {
    StoredDocument store(String originalFilename, InputStream inputStream) throws IOException;
    StoredDocumentResource load(String storageKey) throws IOException;

    record StoredDocument(String storageKey, long sizeBytes) {}
    record StoredDocumentResource(String filename, byte[] bytes) {}
}
