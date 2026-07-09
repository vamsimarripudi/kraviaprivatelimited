package com.kravia.companyos.approval;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "approval_requests")
public class ApprovalRequestEntity extends BaseEntity {
    @Column(nullable = false, length = 240)
    private String title;

    @Column(length = 3000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ApprovalStatus status = ApprovalStatus.DRAFT;

    @Column(length = 320)
    private String approver;

    @Column(length = 2000)
    private String approvalNotes;

    private Instant approvalDate;

    @Column(length = 2000)
    private String rejectionReason;

    @Column(length = 80)
    private String linkedModule;

    private UUID linkedRecordId;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public ApprovalStatus getStatus() { return status; }
    public void setStatus(ApprovalStatus status) { this.status = status; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public String getApprovalNotes() { return approvalNotes; }
    public void setApprovalNotes(String approvalNotes) { this.approvalNotes = approvalNotes; }
    public Instant getApprovalDate() { return approvalDate; }
    public void setApprovalDate(Instant approvalDate) { this.approvalDate = approvalDate; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public String getLinkedModule() { return linkedModule; }
    public void setLinkedModule(String linkedModule) { this.linkedModule = linkedModule; }
    public UUID getLinkedRecordId() { return linkedRecordId; }
    public void setLinkedRecordId(UUID linkedRecordId) { this.linkedRecordId = linkedRecordId; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
