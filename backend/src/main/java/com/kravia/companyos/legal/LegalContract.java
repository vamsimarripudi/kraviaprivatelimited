package com.kravia.companyos.legal;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.legal.LegalEnums.ContractType;
import com.kravia.companyos.legal.LegalEnums.LegalStatus;
import com.kravia.companyos.legal.LegalEnums.SignatureStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "legal_contracts")
public class LegalContract extends BaseEntity {
    @Column(nullable = false)
    private String contractTitle;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ContractType contractType;
    @Column(columnDefinition = "text")
    private String partiesInvolved;
    private LocalDate effectiveDate;
    private LocalDate expiryDate;
    private LocalDate renewalDate;
    @Column(nullable = false)
    private BigDecimal contractValue = BigDecimal.ZERO;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalStatus status = LegalStatus.DRAFT;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LegalStatus approvalStatus = LegalStatus.DRAFT;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SignatureStatus signatureStatus = SignatureStatus.PENDING_SIGNATURE;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_document_id")
    private DocumentRecord relatedDocument;
    private String responsiblePerson;
    @Column(columnDefinition = "text")
    private String notes;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public String getContractTitle() { return contractTitle; }
    public void setContractTitle(String contractTitle) { this.contractTitle = contractTitle; }
    public ContractType getContractType() { return contractType; }
    public void setContractType(ContractType contractType) { this.contractType = contractType; }
    public String getPartiesInvolved() { return partiesInvolved; }
    public void setPartiesInvolved(String partiesInvolved) { this.partiesInvolved = partiesInvolved; }
    public LocalDate getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(LocalDate effectiveDate) { this.effectiveDate = effectiveDate; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public LocalDate getRenewalDate() { return renewalDate; }
    public void setRenewalDate(LocalDate renewalDate) { this.renewalDate = renewalDate; }
    public BigDecimal getContractValue() { return contractValue; }
    public void setContractValue(BigDecimal contractValue) { this.contractValue = contractValue; }
    public LegalStatus getStatus() { return status; }
    public void setStatus(LegalStatus status) { this.status = status; }
    public LegalStatus getApprovalStatus() { return approvalStatus; }
    public void setApprovalStatus(LegalStatus approvalStatus) { this.approvalStatus = approvalStatus; }
    public SignatureStatus getSignatureStatus() { return signatureStatus; }
    public void setSignatureStatus(SignatureStatus signatureStatus) { this.signatureStatus = signatureStatus; }
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
