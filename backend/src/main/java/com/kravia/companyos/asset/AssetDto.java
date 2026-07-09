package com.kravia.companyos.asset;

import com.kravia.companyos.asset.AssetEnums.AssetCategory;
import com.kravia.companyos.asset.AssetEnums.AssetReportType;
import com.kravia.companyos.asset.AssetEnums.AssetStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class AssetDto {
    private AssetDto() {}

    public record AssetMetric(String label, long value, String tone) {}

    public record AssetSummaryResponse(
        long totalAssets,
        long assignedAssets,
        long unassignedAssets,
        long expiringLicenses,
        long warrantyExpiring,
        long assetsUnderMaintenance,
        List<AssetMetric> metrics
    ) {}

    public record AssetRequest(
        String assetName,
        String assetCode,
        AssetCategory category,
        String description,
        LocalDate purchaseDate,
        BigDecimal purchaseCost,
        UUID vendorId,
        String assignedTo,
        String location,
        AssetStatus status,
        LocalDate warrantyStartDate,
        LocalDate warrantyEndDate,
        LocalDate renewalDate,
        UUID relatedDocumentId,
        String notes
    ) {}

    public record AssetResponse(
        UUID id,
        String assetName,
        String assetCode,
        AssetCategory category,
        String description,
        LocalDate purchaseDate,
        BigDecimal purchaseCost,
        UUID vendorId,
        String vendorName,
        String assignedTo,
        String location,
        AssetStatus status,
        LocalDate warrantyStartDate,
        LocalDate warrantyEndDate,
        LocalDate renewalDate,
        UUID relatedDocumentId,
        String relatedDocumentTitle,
        String notes,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {}

    public record AssetAssignmentPayload(
        UUID assetId,
        String assignedTo,
        String assignedBy,
        LocalDate assignedDate,
        LocalDate returnDate,
        String location,
        AssetStatus status,
        String notes
    ) {}

    public record AssetAssignmentResponse(
        UUID id,
        UUID assetId,
        String assetName,
        String assetCode,
        String assignedTo,
        String assignedBy,
        LocalDate assignedDate,
        LocalDate returnDate,
        String location,
        AssetStatus status,
        String notes,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {}

    public record AssetMaintenancePayload(
        UUID assetId,
        String maintenanceTitle,
        String maintenanceType,
        String serviceProvider,
        LocalDate maintenanceDate,
        LocalDate nextMaintenanceDate,
        BigDecimal cost,
        AssetStatus status,
        String notes
    ) {}

    public record AssetMaintenanceResponse(
        UUID id,
        UUID assetId,
        String assetName,
        String assetCode,
        String maintenanceTitle,
        String maintenanceType,
        String serviceProvider,
        LocalDate maintenanceDate,
        LocalDate nextMaintenanceDate,
        BigDecimal cost,
        AssetStatus status,
        String notes,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {}

    public record SoftwareLicensePayload(
        UUID assetId,
        String licenseName,
        String provider,
        String licenseKeyReference,
        Integer seats,
        Integer assignedSeats,
        LocalDate renewalDate,
        AssetStatus status,
        UUID relatedDocumentId,
        String notes
    ) {}

    public record SoftwareLicenseResponse(
        UUID id,
        UUID assetId,
        String assetName,
        String licenseName,
        String provider,
        String licenseKeyReference,
        Integer seats,
        Integer assignedSeats,
        LocalDate renewalDate,
        AssetStatus status,
        UUID relatedDocumentId,
        String relatedDocumentTitle,
        String notes,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {}

    public record CloudResourcePayload(
        UUID assetId,
        String resourceName,
        String provider,
        String resourceType,
        String region,
        String environment,
        BigDecimal monthlyCost,
        String owner,
        AssetStatus status,
        UUID relatedDocumentId,
        String notes
    ) {}

    public record CloudResourceResponse(
        UUID id,
        UUID assetId,
        String assetName,
        String resourceName,
        String provider,
        String resourceType,
        String region,
        String environment,
        BigDecimal monthlyCost,
        String owner,
        AssetStatus status,
        UUID relatedDocumentId,
        String relatedDocumentTitle,
        String notes,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {}

    public record AssetDocumentPayload(
        UUID assetId,
        UUID documentId,
        String documentPurpose,
        AssetStatus status
    ) {}

    public record AssetDocumentResponse(
        UUID id,
        UUID assetId,
        String assetName,
        String assetCode,
        UUID documentId,
        String documentTitle,
        String documentPurpose,
        AssetStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        Instant archivedAt
    ) {}

    public record AssetReportResponse(
        AssetReportType reportType,
        Instant generatedAt,
        List<AssetMetric> metrics,
        List<String> notes
    ) {}
}