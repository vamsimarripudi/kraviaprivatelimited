package com.kravia.companyos.legal;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.legal.LegalEnums.LegalPriority;
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
@Table(name = "legal_obligations")
public class LegalObligation extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private LegalContract contract;
    @Column(nullable = false)
    private String obligationTitle;
    @Column(columnDefinition = "text")
    private String description;
    @Column(nullable = false)
    private String responsiblePerson;
    private LocalDate dueDate;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalStatus status = LegalStatus.DRAFT;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalPriority priority = LegalPriority.MEDIUM;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_document_id")
    private DocumentRecord relatedDocument;
    @Column(columnDefinition = "text")
    private String notes;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public LegalContract getContract() { return contract; }
    public void setContract(LegalContract contract) { this.contract = contract; }
    public String getObligationTitle() { return obligationTitle; }
    public void setObligationTitle(String obligationTitle) { this.obligationTitle = obligationTitle; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getResponsiblePerson() { return responsiblePerson; }
    public void setResponsiblePerson(String responsiblePerson) { this.responsiblePerson = responsiblePerson; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public LegalStatus getStatus() { return status; }
    public void setStatus(LegalStatus status) { this.status = status; }
    public LegalPriority getPriority() { return priority; }
    public void setPriority(LegalPriority priority) { this.priority = priority; }
    public DocumentRecord getRelatedDocument() { return relatedDocument; }
    public void setRelatedDocument(DocumentRecord relatedDocument) { this.relatedDocument = relatedDocument; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
