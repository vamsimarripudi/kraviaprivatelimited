package com.kravia.companyos.ecosystem;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "ecosystem_products")
public class EcosystemProduct extends BaseEntity {
    @Column(nullable = false, length = 255)
    private String productName;

    @Column(nullable = false, unique = true, length = 40)
    private String productCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private EcosystemProductStatus status = EcosystemProductStatus.IDEA;

    @Column(nullable = false, length = 255)
    private String owner;

    @Column(length = 3000)
    private String description;

    @Column(length = 255)
    private String domain;

    @Column(length = 500)
    private String backendUrl;

    @Column(length = 500)
    private String frontendUrl;

    @Column(length = 80)
    private String currentVersion;

    @Column(length = 255)
    private String launchStatus;

    @Column(length = 255)
    private String revenueStatus;

    @Column(length = 255)
    private String complianceStatus;

    @Column(length = 255)
    private String securityStatus;

    @Column(length = 255)
    private String deploymentStatus;

    @Column(length = 3000)
    private String healthNotes;

    @Column(length = 3000)
    private String revenueNotes;

    @Column(length = 3000)
    private String roadmapNotes;

    @Column(length = 3000)
    private String launchChecklist;

    @Column(length = 3000)
    private String riskRegister;

    @Column(nullable = false, length = 255)
    private String createdBy;

    private Instant archivedAt;

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }
    public EcosystemProductStatus getStatus() { return status; }
    public void setStatus(EcosystemProductStatus status) { this.status = status; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public String getBackendUrl() { return backendUrl; }
    public void setBackendUrl(String backendUrl) { this.backendUrl = backendUrl; }
    public String getFrontendUrl() { return frontendUrl; }
    public void setFrontendUrl(String frontendUrl) { this.frontendUrl = frontendUrl; }
    public String getCurrentVersion() { return currentVersion; }
    public void setCurrentVersion(String currentVersion) { this.currentVersion = currentVersion; }
    public String getLaunchStatus() { return launchStatus; }
    public void setLaunchStatus(String launchStatus) { this.launchStatus = launchStatus; }
    public String getRevenueStatus() { return revenueStatus; }
    public void setRevenueStatus(String revenueStatus) { this.revenueStatus = revenueStatus; }
    public String getComplianceStatus() { return complianceStatus; }
    public void setComplianceStatus(String complianceStatus) { this.complianceStatus = complianceStatus; }
    public String getSecurityStatus() { return securityStatus; }
    public void setSecurityStatus(String securityStatus) { this.securityStatus = securityStatus; }
    public String getDeploymentStatus() { return deploymentStatus; }
    public void setDeploymentStatus(String deploymentStatus) { this.deploymentStatus = deploymentStatus; }
    public String getHealthNotes() { return healthNotes; }
    public void setHealthNotes(String healthNotes) { this.healthNotes = healthNotes; }
    public String getRevenueNotes() { return revenueNotes; }
    public void setRevenueNotes(String revenueNotes) { this.revenueNotes = revenueNotes; }
    public String getRoadmapNotes() { return roadmapNotes; }
    public void setRoadmapNotes(String roadmapNotes) { this.roadmapNotes = roadmapNotes; }
    public String getLaunchChecklist() { return launchChecklist; }
    public void setLaunchChecklist(String launchChecklist) { this.launchChecklist = launchChecklist; }
    public String getRiskRegister() { return riskRegister; }
    public void setRiskRegister(String riskRegister) { this.riskRegister = riskRegister; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}
