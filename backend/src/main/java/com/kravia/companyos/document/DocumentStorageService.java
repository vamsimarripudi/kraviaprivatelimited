package com.kravia.companyos.document;

import java.io.IOException;
import java.io.InputStream;

public interface DocumentStorageService {
    StoredDocument store(String originalFilename, InputStream inputStream) throws IOException;
    StoredDocumentResource load(String storagePath) throws IOException;

    record StoredDocument(String storagePath, String safeFileName) {}
    record StoredDocumentResource(String fileName, byte[] bytes) {}
}
