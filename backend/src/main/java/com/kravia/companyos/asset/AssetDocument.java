package com.kravia.companyos.asset;

import com.kravia.companyos.asset.AssetEnums.AssetStatus;
import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "asset_documents")
public class AssetDocument extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id", nullable = false)
    private CompanyAsset asset;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_id", nullable = false)
    private DocumentRecord document;

    private String documentPurpose;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssetStatus status;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public CompanyAsset getAsset() { return asset; }
    public void setAsset(CompanyAsset asset) { this.asset = asset; }
    public DocumentRecord getDocument() { return document; }
    public void setDocument(DocumentRecord document) { this.document = document; }
    public String getDocumentPurpose() { return documentPurpose; }
    public void setDocumentPurpose(String documentPurpose) { this.documentPurpose = documentPurpose; }
    public AssetStatus getStatus() { return status; }
    public void setStatus(AssetStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}