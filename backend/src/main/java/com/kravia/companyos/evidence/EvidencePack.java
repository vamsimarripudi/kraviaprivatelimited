package com.kravia.companyos.evidence;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "evidence_packs")
public class EvidencePack extends BaseEntity {
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 80)
    private EvidencePackType packType;

    @Column(nullable = false, length = 240)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private EvidencePackStatus status = EvidencePackStatus.GENERATED;

    @Column(length = 4000)
    private String sourceSummary;

    @Column(nullable = false, length = 320)
    private String generatedBy;

    @Column(nullable = false)
    private Instant generatedAt;

    @Column(nullable = false)
    private boolean pdfExportAvailable;

    @Column(nullable = false)
    private boolean zipExportAvailable;

    @Column(nullable = false)
    private boolean excelExportAvailable;

    private Instant archivedAt;

    public EvidencePackType getPackType() { return packType; }
    public void setPackType(EvidencePackType packType) { this.packType = packType; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public EvidencePackStatus getStatus() { return status; }
    public void setStatus(EvidencePackStatus status) { this.status = status; }
    public String getSourceSummary() { return sourceSummary; }
    public void setSourceSummary(String sourceSummary) { this.sourceSummary = sourceSummary; }
    public String getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(String generatedBy) { this.generatedBy = generatedBy; }
    public Instant getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(Instant generatedAt) { this.generatedAt = generatedAt; }
    public boolean isPdfExportAvailable() { return pdfExportAvailable; }
    public void setPdfExportAvailable(boolean pdfExportAvailable) { this.pdfExportAvailable = pdfExportAvailable; }
    public boolean isZipExportAvailable() { return zipExportAvailable; }
    public void setZipExportAvailable(boolean zipExportAvailable) { this.zipExportAvailable = zipExportAvailable; }
    public boolean isExcelExportAvailable() { return excelExportAvailable; }
    public void setExcelExportAvailable(boolean excelExportAvailable) { this.excelExportAvailable = excelExportAvailable; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
