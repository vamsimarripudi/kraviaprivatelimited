package com.kravia.companyos.asset;

import com.kravia.companyos.asset.AssetDto.AssetAssignmentPayload;
import com.kravia.companyos.asset.AssetDto.AssetAssignmentResponse;
import com.kravia.companyos.asset.AssetDto.AssetDocumentPayload;
import com.kravia.companyos.asset.AssetDto.AssetDocumentResponse;
import com.kravia.companyos.asset.AssetDto.AssetMaintenancePayload;
import com.kravia.companyos.asset.AssetDto.AssetMaintenanceResponse;
import com.kravia.companyos.asset.AssetDto.AssetMetric;
import com.kravia.companyos.asset.AssetDto.AssetReportResponse;
import com.kravia.companyos.asset.AssetDto.AssetRequest;
import com.kravia.companyos.asset.AssetDto.AssetResponse;
import com.kravia.companyos.asset.AssetDto.AssetSummaryResponse;
import com.kravia.companyos.asset.AssetDto.CloudResourcePayload;
import com.kravia.companyos.asset.AssetDto.CloudResourceResponse;
import com.kravia.companyos.asset.AssetDto.SoftwareLicensePayload;
import com.kravia.companyos.asset.AssetDto.SoftwareLicenseResponse;
import com.kravia.companyos.asset.AssetEnums.AssetCategory;
import com.kravia.companyos.asset.AssetEnums.AssetReportType;
import com.kravia.companyos.asset.AssetEnums.AssetStatus;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.document.DocumentRepository;
import com.kravia.companyos.procurement.ProcurementVendor;
import com.kravia.companyos.procurement.ProcurementVendorRepository;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AssetService {
    private static final String MODULE = "ASSETS";
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final CompanyAssetRepository assets;
    private final AssetAssignmentRepository assignments;
    private final AssetMaintenanceRecordRepository maintenanceRecords;
    private final SoftwareLicenseRepository softwareLicenses;
    private final CloudResourceRepository cloudResources;
    private final AssetDocumentRepository assetDocuments;
    private final ProcurementVendorRepository vendors;
    private final DocumentRepository documents;
    private final PermissionService permissions;
    private final AuditService auditService;

    public AssetService(
        CompanyAssetRepository assets,
        AssetAssignmentRepository assignments,
        AssetMaintenanceRecordRepository maintenanceRecords,
        SoftwareLicenseRepository softwareLicenses,
        CloudResourceRepository cloudResources,
        AssetDocumentRepository assetDocuments,
        ProcurementVendorRepository vendors,
        DocumentRepository documents,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.assets = assets;
        this.assignments = assignments;
        this.maintenanceRecords = maintenanceRecords;
        this.softwareLicenses = softwareLicenses;
        this.cloudResources = cloudResources;
        this.assetDocuments = assetDocuments;
        this.vendors = vendors;
        this.documents = documents;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public AssetSummaryResponse summary(AppUser actor) {
        requireViewer(actor);
        LocalDate today = LocalDate.now();
        LocalDate nextMonth = today.plusDays(30);
        List<CompanyAsset> assetRecords = assets.findAll();
        long totalAssets = assetRecords.stream().filter(asset -> asset.getArchivedAt() == null && asset.getStatus() != AssetStatus.ARCHIVED).count();
        long assignedAssets = assetRecords.stream().filter(asset -> asset.getArchivedAt() == null && asset.getStatus() == AssetStatus.ASSIGNED).count();
        long unassignedAssets = assetRecords.stream().filter(asset -> asset.getArchivedAt() == null && asset.getStatus() == AssetStatus.UNASSIGNED).count();
        long expiringLicenses = softwareLicenses.findAll().stream().filter(license -> isUpcoming(license.getRenewalDate(), today, nextMonth) && active(license.getStatus(), license.getArchivedAt())).count();
        long warrantyExpiring = assetRecords.stream().filter(asset -> isUpcoming(asset.getWarrantyEndDate(), today, nextMonth) && asset.getArchivedAt() == null).count();
        long underMaintenance = assetRecords.stream().filter(asset -> asset.getArchivedAt() == null && asset.getStatus() == AssetStatus.UNDER_MAINTENANCE).count();
        List<AssetMetric> metrics = List.of(
            new AssetMetric("Total assets", totalAssets, "neutral"),
            new AssetMetric("Assigned assets", assignedAssets, "neutral"),
            new AssetMetric("Unassigned assets", unassignedAssets, unassignedAssets == 0 ? "positive" : "warning"),
            new AssetMetric("Expiring licenses", expiringLicenses, expiringLicenses == 0 ? "positive" : "warning"),
            new AssetMetric("Warranty expiring", warrantyExpiring, warrantyExpiring == 0 ? "positive" : "warning"),
            new AssetMetric("Assets under maintenance", underMaintenance, underMaintenance == 0 ? "positive" : "warning")
        );
        return new AssetSummaryResponse(totalAssets, assignedAssets, unassignedAssets, expiringLicenses, warrantyExpiring, underMaintenance, metrics);
    }

    @Transactional(readOnly = true)
    public List<AssetResponse> listAssets(String query, AssetCategory category, AssetStatus status, AppUser actor) {
        requireViewer(actor);
        return assets.findAllByOrderByAssetNameAsc().stream()
            .filter(asset -> category == null || asset.getCategory() == category)
            .filter(asset -> status == null || asset.getStatus() == status)
            .filter(asset -> matches(query, asset.getAssetName(), asset.getAssetCode(), asset.getAssignedTo(), asset.getLocation(), vendorName(asset.getVendor())))
            .map(this::toAssetResponse)
            .toList();
    }

    @Transactional(readOnly = true)
    public AssetResponse getAsset(UUID id, AppUser actor) {
        requireViewer(actor);
        return toAssetResponse(findAsset(id));
    }

    @Transactional
    public AssetResponse createAsset(AssetRequest request, AppUser actor) {
        requireEditor(actor);
        CompanyAsset asset = new CompanyAsset();
        applyAsset(asset, request);
        asset.setCreatedBy(actor.getEmail());
        CompanyAsset saved = assets.save(asset);
        audit(actor, "ASSET_CREATED", "Created asset " + saved.getAssetCode(), "IMPORTANT");
        return toAssetResponse(saved);
    }

    @Transactional
    public AssetResponse updateAsset(UUID id, AssetRequest request, AppUser actor) {
        requireEditor(actor);
        CompanyAsset asset = findAsset(id);
        AssetStatus previousStatus = asset.getStatus();
        applyAsset(asset, request);
        CompanyAsset saved = assets.save(asset);
        audit(actor, "ASSET_UPDATED", "Updated asset " + saved.getAssetCode(), "IMPORTANT");
        auditStatus(actor, "ASSET", saved.getAssetCode(), previousStatus, saved.getStatus());
        return toAssetResponse(saved);
    }

    @Transactional
    public void archiveAsset(UUID id, AppUser actor) {
        requireFounder(actor);
        CompanyAsset asset = findAsset(id);
        asset.setStatus(AssetStatus.ARCHIVED);
        asset.setArchivedAt(Instant.now());
        assets.save(asset);
        audit(actor, "ASSET_ARCHIVED", "Archived asset " + asset.getAssetCode(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<AssetAssignmentResponse> listAssignments(String query, AssetStatus status, AppUser actor) {
        requireViewer(actor);
        return assignments.findAllByOrderByAssignedDateDescCreatedAtDesc().stream()
            .filter(record -> status == null || record.getStatus() == status)
            .filter(record -> matches(query, record.getAssignedTo(), record.getAssignedBy(), record.getLocation(), assetName(record.getAsset()), assetCode(record.getAsset())))
            .map(this::toAssignmentResponse)
            .toList();
    }

    @Transactional
    public AssetAssignmentResponse createAssignment(AssetAssignmentPayload request, AppUser actor) {
        requireEditor(actor);
        AssetAssignment assignment = new AssetAssignment();
        applyAssignment(assignment, request, actor);
        AssetAssignment saved = assignments.save(assignment);
        synchronizeAssetAssignment(saved);
        audit(actor, "ASSET_ASSIGNED", "Assigned asset " + assetCode(saved.getAsset()) + " to " + saved.getAssignedTo(), "IMPORTANT");
        return toAssignmentResponse(saved);
    }

    @Transactional
    public AssetAssignmentResponse updateAssignment(UUID id, AssetAssignmentPayload request, AppUser actor) {
        requireEditor(actor);
        AssetAssignment assignment = findAssignment(id);
        AssetStatus previousStatus = assignment.getStatus();
        applyAssignment(assignment, request, actor);
        AssetAssignment saved = assignments.save(assignment);
        synchronizeAssetAssignment(saved);
        audit(actor, "ASSET_ASSIGNMENT_UPDATED", "Updated assignment for asset " + assetCode(saved.getAsset()), "IMPORTANT");
        auditStatus(actor, "ASSET_ASSIGNMENT", assetCode(saved.getAsset()), previousStatus, saved.getStatus());
        return toAssignmentResponse(saved);
    }

    @Transactional
    public void archiveAssignment(UUID id, AppUser actor) {
        requireFounder(actor);
        AssetAssignment assignment = findAssignment(id);
        assignment.setStatus(AssetStatus.ARCHIVED);
        assignment.setArchivedAt(Instant.now());
        assignments.save(assignment);
        audit(actor, "ASSET_ASSIGNMENT_ARCHIVED", "Archived assignment for asset " + assetCode(assignment.getAsset()), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<AssetMaintenanceResponse> listMaintenance(String query, AssetStatus status, AppUser actor) {
        requireViewer(actor);
        return maintenanceRecords.findAllByOrderByMaintenanceDateDescCreatedAtDesc().stream()
            .filter(record -> status == null || record.getStatus() == status)
            .filter(record -> matches(query, record.getMaintenanceTitle(), record.getMaintenanceType(), record.getServiceProvider(), assetName(record.getAsset()), assetCode(record.getAsset())))
            .map(this::toMaintenanceResponse)
            .toList();
    }

    @Transactional
    public AssetMaintenanceResponse createMaintenance(AssetMaintenancePayload request, AppUser actor) {
        requireEditor(actor);
        AssetMaintenanceRecord record = new AssetMaintenanceRecord();
        applyMaintenance(record, request, actor);
        AssetMaintenanceRecord saved = maintenanceRecords.save(record);
        if (saved.getStatus() == AssetStatus.UNDER_MAINTENANCE) {
            CompanyAsset asset = saved.getAsset();
            asset.setStatus(AssetStatus.UNDER_MAINTENANCE);
            assets.save(asset);
        }
        audit(actor, "ASSET_MAINTENANCE_CREATED", "Created maintenance record for asset " + assetCode(saved.getAsset()), "IMPORTANT");
        return toMaintenanceResponse(saved);
    }

    @Transactional
    public AssetMaintenanceResponse updateMaintenance(UUID id, AssetMaintenancePayload request, AppUser actor) {
        requireEditor(actor);
        AssetMaintenanceRecord record = findMaintenance(id);
        AssetStatus previousStatus = record.getStatus();
        applyMaintenance(record, request, actor);
        AssetMaintenanceRecord saved = maintenanceRecords.save(record);
        audit(actor, "ASSET_MAINTENANCE_UPDATED", "Updated maintenance record for asset " + assetCode(saved.getAsset()), "IMPORTANT");
        auditStatus(actor, "ASSET_MAINTENANCE", assetCode(saved.getAsset()), previousStatus, saved.getStatus());
        return toMaintenanceResponse(saved);
    }

    @Transactional
    public void archiveMaintenance(UUID id, AppUser actor) {
        requireFounder(actor);
        AssetMaintenanceRecord record = findMaintenance(id);
        record.setStatus(AssetStatus.ARCHIVED);
        record.setArchivedAt(Instant.now());
        maintenanceRecords.save(record);
        audit(actor, "ASSET_MAINTENANCE_ARCHIVED", "Archived maintenance record for asset " + assetCode(record.getAsset()), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<SoftwareLicenseResponse> listLicenses(String query, AssetStatus status, AppUser actor) {
        requireViewer(actor);
        return softwareLicenses.findAllByOrderByRenewalDateAscCreatedAtDesc().stream()
            .filter(license -> status == null || license.getStatus() == status)
            .filter(license -> matches(query, license.getLicenseName(), license.getProvider(), assetName(license.getAsset())))
            .map(this::toLicenseResponse)
            .toList();
    }

    @Transactional
    public SoftwareLicenseResponse createLicense(SoftwareLicensePayload request, AppUser actor) {
        requireEditor(actor);
        SoftwareLicense license = new SoftwareLicense();
        applyLicense(license, request, actor);
        SoftwareLicense saved = softwareLicenses.save(license);
        audit(actor, "ASSET_LICENSE_CREATED", "Created license " + saved.getLicenseName(), "IMPORTANT");
        return toLicenseResponse(saved);
    }

    @Transactional
    public SoftwareLicenseResponse updateLicense(UUID id, SoftwareLicensePayload request, AppUser actor) {
        requireEditor(actor);
        SoftwareLicense license = findLicense(id);
        AssetStatus previousStatus = license.getStatus();
        applyLicense(license, request, actor);
        SoftwareLicense saved = softwareLicenses.save(license);
        audit(actor, "ASSET_LICENSE_UPDATED", "Updated license " + saved.getLicenseName(), "IMPORTANT");
        auditStatus(actor, "ASSET_LICENSE", saved.getLicenseName(), previousStatus, saved.getStatus());
        return toLicenseResponse(saved);
    }

    @Transactional
    public void archiveLicense(UUID id, AppUser actor) {
        requireFounder(actor);
        SoftwareLicense license = findLicense(id);
        license.setStatus(AssetStatus.ARCHIVED);
        license.setArchivedAt(Instant.now());
        softwareLicenses.save(license);
        audit(actor, "ASSET_LICENSE_ARCHIVED", "Archived license " + license.getLicenseName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<CloudResourceResponse> listCloudResources(String query, AssetStatus status, AppUser actor) {
        requireViewer(actor);
        return cloudResources.findAllByOrderByResourceNameAsc().stream()
            .filter(resource -> status == null || resource.getStatus() == status)
            .filter(resource -> matches(query, resource.getResourceName(), resource.getProvider(), resource.getResourceType(), resource.getOwner(), assetName(resource.getAsset())))
            .map(this::toCloudResponse)
            .toList();
    }

    @Transactional
    public CloudResourceResponse createCloudResource(CloudResourcePayload request, AppUser actor) {
        requireEditor(actor);
        CloudResource resource = new CloudResource();
        applyCloudResource(resource, request, actor);
        CloudResource saved = cloudResources.save(resource);
        audit(actor, "ASSET_CLOUD_RESOURCE_CREATED", "Created cloud resource " + saved.getResourceName(), "IMPORTANT");
        return toCloudResponse(saved);
    }

    @Transactional
    public CloudResourceResponse updateCloudResource(UUID id, CloudResourcePayload request, AppUser actor) {
        requireEditor(actor);
        CloudResource resource = findCloudResource(id);
        AssetStatus previousStatus = resource.getStatus();
        applyCloudResource(resource, request, actor);
        CloudResource saved = cloudResources.save(resource);
        audit(actor, "ASSET_CLOUD_RESOURCE_UPDATED", "Updated cloud resource " + saved.getResourceName(), "IMPORTANT");
        auditStatus(actor, "ASSET_CLOUD_RESOURCE", saved.getResourceName(), previousStatus, saved.getStatus());
        return toCloudResponse(saved);
    }

    @Transactional
    public void archiveCloudResource(UUID id, AppUser actor) {
        requireFounder(actor);
        CloudResource resource = findCloudResource(id);
        resource.setStatus(AssetStatus.ARCHIVED);
        resource.setArchivedAt(Instant.now());
        cloudResources.save(resource);
        audit(actor, "ASSET_CLOUD_RESOURCE_ARCHIVED", "Archived cloud resource " + resource.getResourceName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<AssetDocumentResponse> listAssetDocuments(String query, AssetStatus status, AppUser actor) {
        requireViewer(actor);
        return assetDocuments.findAllByOrderByCreatedAtDesc().stream()
            .filter(document -> status == null || document.getStatus() == status)
            .filter(document -> matches(query, documentTitle(document.getDocument()), assetName(document.getAsset()), assetCode(document.getAsset()), document.getDocumentPurpose()))
            .map(this::toAssetDocumentResponse)
            .toList();
    }

    @Transactional
    public AssetDocumentResponse createAssetDocument(AssetDocumentPayload request, AppUser actor) {
        requireEditor(actor);
        AssetDocument document = new AssetDocument();
        applyAssetDocument(document, request, actor);
        AssetDocument saved = assetDocuments.save(document);
        audit(actor, "ASSET_DOCUMENT_LINKED", "Linked document to asset " + assetCode(saved.getAsset()), "IMPORTANT");
        return toAssetDocumentResponse(saved);
    }

    @Transactional
    public AssetDocumentResponse updateAssetDocument(UUID id, AssetDocumentPayload request, AppUser actor) {
        requireEditor(actor);
        AssetDocument document = findAssetDocument(id);
        applyAssetDocument(document, request, actor);
        AssetDocument saved = assetDocuments.save(document);
        audit(actor, "ASSET_DOCUMENT_UPDATED", "Updated document link for asset " + assetCode(saved.getAsset()), "IMPORTANT");
        return toAssetDocumentResponse(saved);
    }

    @Transactional
    public void archiveAssetDocument(UUID id, AppUser actor) {
        requireFounder(actor);
        AssetDocument document = findAssetDocument(id);
        document.setStatus(AssetStatus.ARCHIVED);
        document.setArchivedAt(Instant.now());
        assetDocuments.save(document);
        audit(actor, "ASSET_DOCUMENT_ARCHIVED", "Archived document link for asset " + assetCode(document.getAsset()), "WARNING");
    }

    @Transactional(readOnly = true)
    public AssetReportResponse report(AssetReportType type, AppUser actor) {
        requireViewer(actor);
        AssetSummaryResponse summary = summary(actor);
        List<AssetMetric> metrics = switch (type) {
            case ASSET_REGISTER -> List.of(new AssetMetric("Total assets", summary.totalAssets(), "neutral"));
            case ASSIGNMENTS -> List.of(new AssetMetric("Assigned assets", summary.assignedAssets(), "neutral"), new AssetMetric("Unassigned assets", summary.unassignedAssets(), "warning"));
            case MAINTENANCE -> List.of(new AssetMetric("Assets under maintenance", summary.assetsUnderMaintenance(), "warning"));
            case SOFTWARE_LICENSES -> List.of(new AssetMetric("Expiring licenses", summary.expiringLicenses(), "warning"));
            case CLOUD_RESOURCES -> List.of(new AssetMetric("Cloud resources", cloudResources.findAll().stream().filter(resource -> active(resource.getStatus(), resource.getArchivedAt())).count(), "neutral"));
            case DEPRECIATION -> List.of(new AssetMetric("Assets with purchase cost", assets.findAll().stream().filter(asset -> asset.getArchivedAt() == null && money(asset.getPurchaseCost()).compareTo(ZERO) > 0).count(), "neutral"));
            case WARRANTY_EXPIRY -> List.of(new AssetMetric("Warranty expiring", summary.warrantyExpiring(), "warning"));
            case DOCUMENT_LINKS -> List.of(new AssetMetric("Asset document links", assetDocuments.findAll().stream().filter(document -> active(document.getStatus(), document.getArchivedAt())).count(), "neutral"));
        };
        audit(actor, "ASSET_REPORT_GENERATED", "Generated asset report " + type, "INFO");
        return new AssetReportResponse(type, Instant.now(), metrics, metrics.isEmpty() ? List.of("No information has been added yet.") : List.of());
    }

    private void applyAsset(CompanyAsset asset, AssetRequest request) {
        String assetCode = required(request.assetCode(), "Asset code").toUpperCase(Locale.ROOT);
        if ((asset.getId() == null || !assetCode.equalsIgnoreCase(asset.getAssetCode())) && assets.existsByAssetCodeIgnoreCase(assetCode)) {
            throw new IllegalArgumentException("Asset code already exists.");
        }
        asset.setAssetName(required(request.assetName(), "Asset name"));
        asset.setAssetCode(assetCode);
        asset.setCategory(required(request.category(), "Category"));
        asset.setDescription(blankToNull(request.description()));
        asset.setPurchaseDate(request.purchaseDate());
        asset.setPurchaseCost(money(request.purchaseCost()));
        asset.setVendor(findVendor(request.vendorId()));
        asset.setAssignedTo(blankToNull(request.assignedTo()));
        asset.setLocation(blankToNull(request.location()));
        asset.setStatus(required(request.status(), "Status"));
        asset.setWarrantyStartDate(request.warrantyStartDate());
        asset.setWarrantyEndDate(request.warrantyEndDate());
        asset.setRenewalDate(request.renewalDate());
        asset.setRelatedDocument(findDocument(request.relatedDocumentId()));
        asset.setNotes(blankToNull(request.notes()));
    }

    private void applyAssignment(AssetAssignment assignment, AssetAssignmentPayload request, AppUser actor) {
        assignment.setAsset(findAsset(required(request.assetId(), "Asset")));
        assignment.setAssignedTo(required(request.assignedTo(), "Assigned to"));
        String assignedBy = blankToNull(request.assignedBy());
        assignment.setAssignedBy(assignedBy == null ? actor.getEmail() : assignedBy);
        assignment.setAssignedDate(required(request.assignedDate(), "Assigned date"));
        assignment.setReturnDate(request.returnDate());
        assignment.setLocation(blankToNull(request.location()));
        assignment.setStatus(required(request.status(), "Status"));
        assignment.setNotes(blankToNull(request.notes()));
        if (assignment.getCreatedBy() == null) assignment.setCreatedBy(actor.getEmail());
    }

    private void applyMaintenance(AssetMaintenanceRecord record, AssetMaintenancePayload request, AppUser actor) {
        record.setAsset(findAsset(required(request.assetId(), "Asset")));
        record.setMaintenanceTitle(required(request.maintenanceTitle(), "Maintenance title"));
        record.setMaintenanceType(blankToNull(request.maintenanceType()));
        record.setServiceProvider(blankToNull(request.serviceProvider()));
        record.setMaintenanceDate(required(request.maintenanceDate(), "Maintenance date"));
        record.setNextMaintenanceDate(request.nextMaintenanceDate());
        record.setCost(money(request.cost()));
        record.setStatus(required(request.status(), "Status"));
        record.setNotes(blankToNull(request.notes()));
        if (record.getCreatedBy() == null) record.setCreatedBy(actor.getEmail());
    }

    private void applyLicense(SoftwareLicense license, SoftwareLicensePayload request, AppUser actor) {
        license.setAsset(findOptionalAsset(request.assetId()));
        license.setLicenseName(required(request.licenseName(), "License name"));
        license.setProvider(blankToNull(request.provider()));
        license.setLicenseKeyReference(blankToNull(request.licenseKeyReference()));
        license.setSeats(nonNegative(request.seats(), "Seats"));
        license.setAssignedSeats(nonNegative(request.assignedSeats(), "Assigned seats"));
        if (license.getSeats() != null && license.getAssignedSeats() != null && license.getAssignedSeats() > license.getSeats()) throw new IllegalArgumentException("Assigned seats cannot exceed seats.");
        license.setRenewalDate(request.renewalDate());
        license.setStatus(required(request.status(), "Status"));
        license.setRelatedDocument(findDocument(request.relatedDocumentId()));
        license.setNotes(blankToNull(request.notes()));
        if (license.getCreatedBy() == null) license.setCreatedBy(actor.getEmail());
    }

    private void applyCloudResource(CloudResource resource, CloudResourcePayload request, AppUser actor) {
        resource.setAsset(findOptionalAsset(request.assetId()));
        resource.setResourceName(required(request.resourceName(), "Resource name"));
        resource.setProvider(blankToNull(request.provider()));
        resource.setResourceType(blankToNull(request.resourceType()));
        resource.setRegion(blankToNull(request.region()));
        resource.setEnvironment(blankToNull(request.environment()));
        resource.setMonthlyCost(money(request.monthlyCost()));
        resource.setOwner(blankToNull(request.owner()));
        resource.setStatus(required(request.status(), "Status"));
        resource.setRelatedDocument(findDocument(request.relatedDocumentId()));
        resource.setNotes(blankToNull(request.notes()));
        if (resource.getCreatedBy() == null) resource.setCreatedBy(actor.getEmail());
    }

    private void applyAssetDocument(AssetDocument document, AssetDocumentPayload request, AppUser actor) {
        document.setAsset(findAsset(required(request.assetId(), "Asset")));
        document.setDocument(required(findDocument(request.documentId()), "Document"));
        document.setDocumentPurpose(blankToNull(request.documentPurpose()));
        document.setStatus(required(request.status(), "Status"));
        if (document.getCreatedBy() == null) document.setCreatedBy(actor.getEmail());
    }

    private void synchronizeAssetAssignment(AssetAssignment assignment) {
        CompanyAsset asset = assignment.getAsset();
        if (assignment.getStatus() == AssetStatus.ASSIGNED && assignment.getArchivedAt() == null) {
            asset.setAssignedTo(assignment.getAssignedTo());
            asset.setLocation(assignment.getLocation());
            asset.setStatus(AssetStatus.ASSIGNED);
        } else if (assignment.getReturnDate() != null || assignment.getStatus() == AssetStatus.UNASSIGNED) {
            asset.setAssignedTo(null);
            asset.setStatus(AssetStatus.UNASSIGNED);
        }
        assets.save(asset);
    }

    private AssetResponse toAssetResponse(CompanyAsset asset) {
        return new AssetResponse(asset.getId(), asset.getAssetName(), asset.getAssetCode(), asset.getCategory(), asset.getDescription(), asset.getPurchaseDate(), money(asset.getPurchaseCost()), id(asset.getVendor()), vendorName(asset.getVendor()), asset.getAssignedTo(), asset.getLocation(), asset.getStatus(), asset.getWarrantyStartDate(), asset.getWarrantyEndDate(), asset.getRenewalDate(), id(asset.getRelatedDocument()), documentTitle(asset.getRelatedDocument()), asset.getNotes(), asset.getCreatedBy(), asset.getCreatedAt(), asset.getUpdatedAt(), asset.getArchivedAt());
    }

    private AssetAssignmentResponse toAssignmentResponse(AssetAssignment record) {
        return new AssetAssignmentResponse(record.getId(), id(record.getAsset()), assetName(record.getAsset()), assetCode(record.getAsset()), record.getAssignedTo(), record.getAssignedBy(), record.getAssignedDate(), record.getReturnDate(), record.getLocation(), record.getStatus(), record.getNotes(), record.getCreatedBy(), record.getCreatedAt(), record.getUpdatedAt(), record.getArchivedAt());
    }

    private AssetMaintenanceResponse toMaintenanceResponse(AssetMaintenanceRecord record) {
        return new AssetMaintenanceResponse(record.getId(), id(record.getAsset()), assetName(record.getAsset()), assetCode(record.getAsset()), record.getMaintenanceTitle(), record.getMaintenanceType(), record.getServiceProvider(), record.getMaintenanceDate(), record.getNextMaintenanceDate(), money(record.getCost()), record.getStatus(), record.getNotes(), record.getCreatedBy(), record.getCreatedAt(), record.getUpdatedAt(), record.getArchivedAt());
    }

    private SoftwareLicenseResponse toLicenseResponse(SoftwareLicense license) {
        return new SoftwareLicenseResponse(license.getId(), id(license.getAsset()), assetName(license.getAsset()), license.getLicenseName(), license.getProvider(), license.getLicenseKeyReference(), license.getSeats(), license.getAssignedSeats(), license.getRenewalDate(), license.getStatus(), id(license.getRelatedDocument()), documentTitle(license.getRelatedDocument()), license.getNotes(), license.getCreatedBy(), license.getCreatedAt(), license.getUpdatedAt(), license.getArchivedAt());
    }

    private CloudResourceResponse toCloudResponse(CloudResource resource) {
        return new CloudResourceResponse(resource.getId(), id(resource.getAsset()), assetName(resource.getAsset()), resource.getResourceName(), resource.getProvider(), resource.getResourceType(), resource.getRegion(), resource.getEnvironment(), money(resource.getMonthlyCost()), resource.getOwner(), resource.getStatus(), id(resource.getRelatedDocument()), documentTitle(resource.getRelatedDocument()), resource.getNotes(), resource.getCreatedBy(), resource.getCreatedAt(), resource.getUpdatedAt(), resource.getArchivedAt());
    }

    private AssetDocumentResponse toAssetDocumentResponse(AssetDocument document) {
        return new AssetDocumentResponse(document.getId(), id(document.getAsset()), assetName(document.getAsset()), assetCode(document.getAsset()), id(document.getDocument()), documentTitle(document.getDocument()), document.getDocumentPurpose(), document.getStatus(), document.getCreatedBy(), document.getCreatedAt(), document.getUpdatedAt(), document.getArchivedAt());
    }

    private CompanyAsset findAsset(UUID id) { return assets.findById(id).orElseThrow(() -> new NotFoundException("Asset not found.")); }
    private CompanyAsset findOptionalAsset(UUID id) { return id == null ? null : findAsset(id); }
    private AssetAssignment findAssignment(UUID id) { return assignments.findById(id).orElseThrow(() -> new NotFoundException("Asset assignment not found.")); }
    private AssetMaintenanceRecord findMaintenance(UUID id) { return maintenanceRecords.findById(id).orElseThrow(() -> new NotFoundException("Asset maintenance record not found.")); }
    private SoftwareLicense findLicense(UUID id) { return softwareLicenses.findById(id).orElseThrow(() -> new NotFoundException("Software license not found.")); }
    private CloudResource findCloudResource(UUID id) { return cloudResources.findById(id).orElseThrow(() -> new NotFoundException("Cloud resource not found.")); }
    private AssetDocument findAssetDocument(UUID id) { return assetDocuments.findById(id).orElseThrow(() -> new NotFoundException("Asset document link not found.")); }
    private ProcurementVendor findVendor(UUID id) { return id == null ? null : vendors.findById(id).orElseThrow(() -> new NotFoundException("Vendor not found.")); }
    private DocumentRecord findDocument(UUID id) { return id == null ? null : documents.findById(id).orElseThrow(() -> new NotFoundException("Document not found.")); }

    private boolean active(AssetStatus status, Instant archivedAt) { return archivedAt == null && status != AssetStatus.ARCHIVED && status != AssetStatus.RETIRED && status != AssetStatus.SOLD; }
    private boolean isUpcoming(LocalDate date, LocalDate today, LocalDate nextMonth) { return date != null && !date.isBefore(today) && !date.isAfter(nextMonth); }
    private UUID id(Object entity) {
        if (entity instanceof CompanyAsset asset) return asset.getId();
        if (entity instanceof ProcurementVendor vendor) return vendor.getId();
        if (entity instanceof DocumentRecord document) return document.getId();
        return null;
    }
    private String assetName(CompanyAsset asset) { return asset == null ? null : asset.getAssetName(); }
    private String assetCode(CompanyAsset asset) { return asset == null ? null : asset.getAssetCode(); }
    private String vendorName(ProcurementVendor vendor) { return vendor == null ? null : vendor.getVendorName(); }
    private String documentTitle(DocumentRecord document) { return document == null ? null : document.getTitle(); }
    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private void requireFounder(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER); }
    private void audit(AppUser actor, String action, String description, String severity) { auditService.record(actor, MODULE, action, description, severity); }
    private void auditStatus(AppUser actor, String type, String label, AssetStatus previous, AssetStatus current) {
        if (previous != null && current != null && previous != current) {
            audit(actor, type + "_STATUS_CHANGED", "Changed " + label + " status to " + current, "IMPORTANT");
        }
    }
    private BigDecimal money(BigDecimal value) { return value == null ? ZERO : value.setScale(2, RoundingMode.HALF_UP); }
    private Integer nonNegative(Integer value, String label) { if (value != null && value < 0) throw new IllegalArgumentException(label + " cannot be negative."); return value; }
    private String required(String value, String label) { if (value == null || value.isBlank()) throw new IllegalArgumentException(label + " is required."); return value.trim(); }
    private <T> T required(T value, String label) { if (value == null) throw new IllegalArgumentException(label + " is required."); return value; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private boolean matches(String query, String... values) {
        if (query == null || query.isBlank()) return true;
        String needle = query.toLowerCase(Locale.ROOT).trim();
        for (String value : values) if (value != null && value.toLowerCase(Locale.ROOT).contains(needle)) return true;
        return false;
    }
}
