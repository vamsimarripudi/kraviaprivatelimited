package com.kravia.companyos.asset;

import com.kravia.companyos.asset.AssetDto.AssetAssignmentPayload;
import com.kravia.companyos.asset.AssetDto.AssetAssignmentResponse;
import com.kravia.companyos.asset.AssetDto.AssetDocumentPayload;
import com.kravia.companyos.asset.AssetDto.AssetDocumentResponse;
import com.kravia.companyos.asset.AssetDto.AssetMaintenancePayload;
import com.kravia.companyos.asset.AssetDto.AssetMaintenanceResponse;
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
import com.kravia.companyos.user.AppUser;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/assets")
public class AssetController {
    private final AssetService service;

    public AssetController(AssetService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public AssetSummaryResponse summary(@AuthenticationPrincipal AppUser actor) {
        return service.summary(actor);
    }

    @GetMapping
    public List<AssetResponse> assets(@RequestParam(required = false) String query, @RequestParam(required = false) AssetCategory category, @RequestParam(required = false) AssetStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listAssets(query, category, status, actor);
    }

    @GetMapping("/{id}")
    public AssetResponse asset(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.getAsset(id, actor);
    }

    @PostMapping
    public AssetResponse createAsset(@RequestBody AssetRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createAsset(request, actor);
    }

    @PutMapping("/{id}")
    public AssetResponse updateAsset(@PathVariable UUID id, @RequestBody AssetRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateAsset(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archiveAsset(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveAsset(id, actor);
    }

    @GetMapping("/assignments")
    public List<AssetAssignmentResponse> assignments(@RequestParam(required = false) String query, @RequestParam(required = false) AssetStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listAssignments(query, status, actor);
    }

    @PostMapping("/assignments")
    public AssetAssignmentResponse createAssignment(@RequestBody AssetAssignmentPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createAssignment(request, actor);
    }

    @PutMapping("/assignments/{id}")
    public AssetAssignmentResponse updateAssignment(@PathVariable UUID id, @RequestBody AssetAssignmentPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateAssignment(id, request, actor);
    }

    @DeleteMapping("/assignments/{id}")
    public void archiveAssignment(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveAssignment(id, actor);
    }

    @GetMapping("/maintenance")
    public List<AssetMaintenanceResponse> maintenance(@RequestParam(required = false) String query, @RequestParam(required = false) AssetStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listMaintenance(query, status, actor);
    }

    @PostMapping("/maintenance")
    public AssetMaintenanceResponse createMaintenance(@RequestBody AssetMaintenancePayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createMaintenance(request, actor);
    }

    @PutMapping("/maintenance/{id}")
    public AssetMaintenanceResponse updateMaintenance(@PathVariable UUID id, @RequestBody AssetMaintenancePayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateMaintenance(id, request, actor);
    }

    @DeleteMapping("/maintenance/{id}")
    public void archiveMaintenance(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveMaintenance(id, actor);
    }

    @GetMapping("/licenses")
    public List<SoftwareLicenseResponse> licenses(@RequestParam(required = false) String query, @RequestParam(required = false) AssetStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listLicenses(query, status, actor);
    }

    @PostMapping("/licenses")
    public SoftwareLicenseResponse createLicense(@RequestBody SoftwareLicensePayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createLicense(request, actor);
    }

    @PutMapping("/licenses/{id}")
    public SoftwareLicenseResponse updateLicense(@PathVariable UUID id, @RequestBody SoftwareLicensePayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateLicense(id, request, actor);
    }

    @DeleteMapping("/licenses/{id}")
    public void archiveLicense(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveLicense(id, actor);
    }

    @GetMapping("/cloud-resources")
    public List<CloudResourceResponse> cloudResources(@RequestParam(required = false) String query, @RequestParam(required = false) AssetStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listCloudResources(query, status, actor);
    }

    @PostMapping("/cloud-resources")
    public CloudResourceResponse createCloudResource(@RequestBody CloudResourcePayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createCloudResource(request, actor);
    }

    @PutMapping("/cloud-resources/{id}")
    public CloudResourceResponse updateCloudResource(@PathVariable UUID id, @RequestBody CloudResourcePayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateCloudResource(id, request, actor);
    }

    @DeleteMapping("/cloud-resources/{id}")
    public void archiveCloudResource(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveCloudResource(id, actor);
    }

    @GetMapping("/documents")
    public List<AssetDocumentResponse> assetDocuments(@RequestParam(required = false) String query, @RequestParam(required = false) AssetStatus status, @AuthenticationPrincipal AppUser actor) {
        return service.listAssetDocuments(query, status, actor);
    }

    @PostMapping("/documents")
    public AssetDocumentResponse createAssetDocument(@RequestBody AssetDocumentPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.createAssetDocument(request, actor);
    }

    @PutMapping("/documents/{id}")
    public AssetDocumentResponse updateAssetDocument(@PathVariable UUID id, @RequestBody AssetDocumentPayload request, @AuthenticationPrincipal AppUser actor) {
        return service.updateAssetDocument(id, request, actor);
    }

    @DeleteMapping("/documents/{id}")
    public void archiveAssetDocument(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveAssetDocument(id, actor);
    }

    @GetMapping("/reports")
    public AssetReportResponse report(@RequestParam(defaultValue = "ASSET_REGISTER") AssetReportType type, @AuthenticationPrincipal AppUser actor) {
        return service.report(type, actor);
    }
}
