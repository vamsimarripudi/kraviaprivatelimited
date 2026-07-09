package com.kravia.companyos.product;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "products")
public class CompanyProduct extends BaseEntity {
    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProductCategory category;

    @Column(length = 3000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private ProductStatus status = ProductStatus.IDEA;

    @Column(nullable = false)
    private String developmentStage;

    @Column(nullable = false)
    private Integer launchReadinessPercentage = 0;

    @Column(length = 1500)
    private String targetUsers;

    @Column(length = 1500)
    private String pricingNotes;

    @Column(length = 1500)
    private String revenueNotes;

    @Column(length = 3000)
    private String keyFeatures;

    @Column(length = 3000)
    private String pendingWork;

    @Column(length = 3000)
    private String risks;

    private String nextMilestone;

    private String responsiblePerson;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public ProductCategory getCategory() { return category; }
    public void setCategory(ProductCategory category) { this.category = category; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public ProductStatus getStatus() { return status; }
    public void setStatus(ProductStatus status) { this.status = status; }
    public String getDevelopmentStage() { return developmentStage; }
    public void setDevelopmentStage(String developmentStage) { this.developmentStage = developmentStage; }
    public Integer getLaunchReadinessPercentage() { return launchReadinessPercentage; }
    public void setLaunchReadinessPercentage(Integer launchReadinessPercentage) { this.launchReadinessPercentage = launchReadinessPercentage; }
    public String getTargetUsers() { return targetUsers; }
    public void setTargetUsers(String targetUsers) { this.targetUsers = targetUsers; }
    public String getPricingNotes() { return pricingNotes; }
    public void setPricingNotes(String pricingNotes) { this.pricingNotes = pricingNotes; }
    public String getRevenueNotes() { return revenueNotes; }
    public void setRevenueNotes(String revenueNotes) { this.revenueNotes = revenueNotes; }
    public String getKeyFeatures() { return keyFeatures; }
    public void setKeyFeatures(String keyFeatures) { this.keyFeatures = keyFeatures; }
    public String getPendingWork() { return pendingWork; }
    public void setPendingWork(String pendingWork) { this.pendingWork = pendingWork; }
    public String getRisks() { return risks; }
    public void setRisks(String risks) { this.risks = risks; }
    public String getNextMilestone() { return nextMilestone; }
    public void setNextMilestone(String nextMilestone) { this.nextMilestone = nextMilestone; }
    public String getResponsiblePerson() { return responsiblePerson; }
    public void setResponsiblePerson(String responsiblePerson) { this.responsiblePerson = responsiblePerson; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}