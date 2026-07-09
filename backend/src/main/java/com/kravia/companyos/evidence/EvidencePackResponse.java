package com.kravia.companyos.evidence;

import java.time.Instant;
import java.util.UUID;

public record EvidencePackResponse(
    UUID id,
    EvidencePackType packType,
    String title,
    EvidencePackStatus status,
    String sourceSummary,
    String generatedBy,
    Instant generatedAt,
    boolean pdfExportAvailable,
    boolean zipExportAvailable,
    boolean excelExportAvailable
) {
    public static EvidencePackResponse from(EvidencePack pack) {
        return new EvidencePackResponse(
            pack.getId(),
            pack.getPackType(),
            pack.getTitle(),
            pack.getStatus(),
            pack.getSourceSummary(),
            pack.getGeneratedBy(),
            pack.getGeneratedAt(),
            pack.isPdfExportAvailable(),
            pack.isZipExportAvailable(),
            pack.isExcelExportAvailable()
        );
    }
}
