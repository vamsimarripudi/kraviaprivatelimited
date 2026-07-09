package com.kravia.companyos.hr;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.hr.HrEnums.ExitStatus;
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
@Table(name = "exit_records")
public class ExitRecord extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;
    private LocalDate resignationDate;
    private LocalDate lastWorkingDay;
    @Column(columnDefinition = "text")
    private String reason;
    @Column(columnDefinition = "text")
    private String exitChecklist;
    private String assetReturnStatus;
    private String finalSettlementStatus;
    private String knowledgeTransferStatus;
    @Column(columnDefinition = "text")
    private String exitInterviewNotes;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "related_document_id")
    private DocumentRecord relatedDocument;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExitStatus status;
    @Column(nullable = false)
    private String createdBy;
    private Instant archivedAt;

    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public LocalDate getResignationDate() { return resignationDate; }
    public void setResignationDate(LocalDate resignationDate) { this.resignationDate = resignationDate; }
    public LocalDate getLastWorkingDay() { return lastWorkingDay; }
    public void setLastWorkingDay(LocalDate lastWorkingDay) { this.lastWorkingDay = lastWorkingDay; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getExitChecklist() { return exitChecklist; }
    public void setExitChecklist(String exitChecklist) { this.exitChecklist = exitChecklist; }
    public String getAssetReturnStatus() { return assetReturnStatus; }
    public void setAssetReturnStatus(String assetReturnStatus) { this.assetReturnStatus = assetReturnStatus; }
    public String getFinalSettlementStatus() { return finalSettlementStatus; }
    public void setFinalSettlementStatus(String finalSettlementStatus) { this.finalSettlementStatus = finalSettlementStatus; }
    public String getKnowledgeTransferStatus() { return knowledgeTransferStatus; }
    public void setKnowledgeTransferStatus(String knowledgeTransferStatus) { this.knowledgeTransferStatus = knowledgeTransferStatus; }
    public String getExitInterviewNotes() { return exitInterviewNotes; }
    public void setExitInterviewNotes(String exitInterviewNotes) { this.exitInterviewNotes = exitInterviewNotes; }
    public DocumentRecord getRelatedDocument() { return relatedDocument; }
    public void setRelatedDocument(DocumentRecord relatedDocument) { this.relatedDocument = relatedDocument; }
    public ExitStatus getStatus() { return status; }
    public void setStatus(ExitStatus status) { this.status = status; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
