package com.kravia.companyos.asset;

import com.kravia.companyos.asset.AssetEnums.AssetStatus;
import com.kravia.companyos.common.BaseEntity;
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
@Table(name = "asset_maintenance_records")
public class AssetMaintenanceRecord extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "asset_id", nullable = false)
    private CompanyAsset asset;

    @Column(nullable = false)
    private String maintenanceTitle;

    private String maintenanceType;
    private String serviceProvider;

    @Column(nullable = false)
    private LocalDate maintenanceDate;

    private LocalDate nextMaintenanceDate;

    @Column(precision = 19, scale = 2)
    private BigDecimal cost;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssetStatus status;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false)
    private String createdBy;

    private Instant archivedAt;

    public CompanyAsset getAsset() { return asset; }
    public void setAsset(CompanyAsset asset) { this.asset = asset; }
    public String getMaintenanceTitle() { return maintenanceTitle; }
    public void setMaintenanceTitle(String maintenanceTitle) { this.maintenanceTitle = maintenanceTitle; }
    public String getMaintenanceType() { return maintenanceType; }
    public void setMaintenanceType(String maintenanceType) { this.maintenanceType = maintenanceType; }
    public String getServiceProvider() { return serviceProvider; }
    public void setServiceProvider(String serviceProvider) { this.serviceProvider = serviceProvider; }
    public LocalDate getMaintenanceDate() { return maintenanceDate; }
    public void setMaintenanceDate(LocalDate maintenanceDate) { this.maintenanceDate = maintenanceDate; }
    public LocalDate getNextMaintenanceDate() { return nextMaintenanceDate; }
    public void setNextMaintenanceDate(LocalDate nextMaintenanceDate) { this.nextMaintenanceDate = nextMaintenanceDate; }
    public BigDecimal getCost() { return cost; }
    public void setCost(BigDecimal cost) { this.cost = cost; }
    public AssetStatus getStatus() { return status; }
    public void setStatus(AssetStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public Instant getArchivedAt() { return archivedAt; }
    public void setArchivedAt(Instant archivedAt) { this.archivedAt = archivedAt; }
}