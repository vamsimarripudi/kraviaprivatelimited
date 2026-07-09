package com.kravia.companyos.task;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "company_tasks")
public class CompanyTask extends BaseEntity {
    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private TaskCategory category;

    @Column(length = 3000)
    private String description;

    private String assignedTo;

    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TaskPriority priority = TaskPriority.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TaskStatus status = TaskStatus.TODO;

    private String relatedSection;

    private UUID relatedDocumentId;

    @Column(length = 4000)
    private String notes;

    @Column(nullable = false)
    private String createdBy;

    private Instant completedAt;

    private Instant archivedAt;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public TaskCategory getCategory() { return category; }
    public void setCategory(TaskCategory category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }
    public TaskPriority getPriority() { return priority; }
    public void setPriority(TaskPriority priority) { this.priority = priority; }
    public TaskStatus getStatus() { return status; }
    public void setStatus(TaskStatus status) { this.status = status; }
    public String getRelatedSection() { return relatedSection; }
    public void setRelatedSection(String relatedSection) { this.relatedSection = relatedSection; }
    public UUID getRelatedDocumentId() { return relatedDocumentId; }
    public void setRelatedDocumentId(UUID relatedDocumentId) { this.relatedDocumentId = relatedDocumentId; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}