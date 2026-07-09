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
@Table(name = "legal_approvals")
public class LegalApproval extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contract_id")
    private LegalContract contract;
    @Column(nullable = false)
    private String approvalTitle;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalStatus approvalStatus = LegalStatus.PENDING_APPROVAL;
    private String approver;
    @Column(columnDefinition = "text")
    private String approvalNotes;
    private LocalDate approvalDate;
    @Column(columnDefinition = "text")
    private String rejectionReason;
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
    public String getApprovalTitle() { return approvalTitle; }
    public void setApprovalTitle(String approvalTitle) { this.approvalTitle = approvalTitle; }
    public LegalStatus getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(LegalStatus approvalStatus) { this.approvalStatus = approvalStatus; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public String getApprovalNotes() { return approvalNotes; }
    public void setApprovalNotes(String approvalNotes) { this.approvalNotes = approvalNotes; }
    public LocalDate getApprovalDate() { return approvalDate; }
    public void setApprovalDate(LocalDate approvalDate) { this.approvalDate = approvalDate; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public DocumentRecord getRelatedDocument() { return relatedDocument; }
    public void setRelatedDocument(DocumentRecord relatedDocument) { this.relatedDocument = relatedDocument; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
