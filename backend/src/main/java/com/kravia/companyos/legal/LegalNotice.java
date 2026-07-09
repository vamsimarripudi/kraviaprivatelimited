package com.kravia.companyos.legal;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.legal.LegalEnums.LegalStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "legal_notices")
public class LegalNotice extends BaseEntity {
    @Column(nullable = false)
    private String noticeTitle;
    private String noticeType;
    private String issuedBy;
    @Column(nullable = false)
    private String issuedTo;
    @Column(nullable = false)
    private LocalDate noticeDate;
    private LocalDate responseDueDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalStatus status = LegalStatus.UNDER_REVIEW;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_document_id")
    private DocumentRecord relatedDocument;
    private String responsiblePerson;
    @Column(columnDefinition = "text")
    private String notes;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public String getNoticeTitle() { return noticeTitle; }
    public void setNoticeTitle(String noticeTitle) { this.noticeTitle = noticeTitle; }
    public String getNoticeType() { return noticeType; }
    public void setNoticeType(String noticeType) { this.noticeType = noticeType; }
    public String getIssuedBy() { return issuedBy; }
    public void setIssuedBy(String issuedBy) { this.issuedBy = issuedBy; }
    public String getIssuedTo() { return issuedTo; }
    public void setIssuedTo(String issuedTo) { this.issuedTo = issuedTo; }
    public LocalDate getNoticeDate() { return noticeDate; }
    public void setNoticeDate(LocalDate noticeDate) { this.noticeDate = noticeDate; }
    public LocalDate getResponseDueDate() { return responseDueDate; }
    public void setResponseDueDate(LocalDate responseDueDate) { this.responseDueDate = responseDueDate; }
    public LegalStatus getStatus() { return status; }
    public void setStatus(LegalStatus status) { this.status = status; }
    public DocumentRecord getRelatedDocument() { return relatedDocument; }
    public void setRelatedDocument(DocumentRecord relatedDocument) { this.relatedDocument = relatedDocument; }
    public String getResponsiblePerson() { return responsiblePerson; }
    public void setResponsiblePerson(String responsiblePerson) { this.responsiblePerson = responsiblePerson; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
