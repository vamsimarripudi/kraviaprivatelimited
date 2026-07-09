package com.kravia.companyos.risk;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "risk_register_entries")
public class RiskRegisterEntry extends BaseEntity {
    @Column(nullable = false, length = 240)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private RiskCategory category;

    @Column(length = 3000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private RiskLevel severity = RiskLevel.MEDIUM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private RiskLevel likelihood = RiskLevel.MEDIUM;

    @Column(length = 320)
    private String owner;

    @Column(length = 3000)
    private String mitigationPlan;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private RiskStatus status = RiskStatus.OPEN;

    private LocalDate reviewDate;

    @Column(length = 2000)
    private String relatedRecords;

    @Column(nullable = false, length = 320)
    private String createdBy;

    private Instant archivedAt;

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public RiskCategory getCategory() { return category; }
    public void setCategory(RiskCategory category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public RiskLevel getSeverity() { return severity; }
    public void setSeverity(RiskLevel severity) { this.severity = severity; }
    public RiskLevel getLikelihood() { return likelihood; }
    public void setLikelihood(RiskLevel likelihood) { this.likelihood = likelihood; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getMitigationPlan() { return mitigationPlan; }
    public void setMitigationPlan(String mitigationPlan) { this.mitigationPlan = mitigationPlan; }
    public RiskStatus getStatus() { return status; }
    public void setStatus(RiskStatus status) { this.status = status; }
    public LocalDate getReviewDate() { return reviewDate; }
    public void setReviewDate(LocalDate reviewDate) { this.reviewDate = reviewDate; }
    public String getRelatedRecords() { return relatedRecords; }
    public void setRelatedRecords(String relatedRecords) { this.relatedRecords = relatedRecords; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
