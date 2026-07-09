package com.kravia.companyos.ecosystem;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EcosystemService {
    private static final String MODULE = "ECOSYSTEM_CONTROL_PLANE";
    private static final Set<EcosystemProductStatus> ACTIVE_STATUSES = Set.of(
        EcosystemProductStatus.IDEA,
        EcosystemProductStatus.DEVELOPMENT,
        EcosystemProductStatus.TESTING,
        EcosystemProductStatus.STAGING,
        EcosystemProductStatus.LAUNCH_READY,
        EcosystemProductStatus.LIVE
    );

    private final EcosystemProductRepository products;
    private final PermissionService permissions;
    private final AuditService auditService;

    public EcosystemService(EcosystemProductRepository products, PermissionService permissions, AuditService auditService) {
        this.products = products;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<EcosystemProductResponse> list(String query, EcosystemProductStatus status, String owner, AppUser actor) {
        requireViewer(actor);
        return products.search(normalize(query), status, normalize(owner)).stream().map(EcosystemProductResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public EcosystemProductResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return EcosystemProductResponse.from(find(id));
    }

    @Transactional(readOnly = true)
    public EcosystemSummaryResponse summary(AppUser actor) {
        requireViewer(actor);
        List<EcosystemProduct> records = products.findAll();
        return new EcosystemSummaryResponse(
            records.size(),
            records.stream().filter((product) -> ACTIVE_STATUSES.contains(product.getStatus())).count(),
            records.stream().filter((product) -> product.getStatus() == EcosystemProductStatus.LAUNCH_READY).count(),
            records.stream().filter((product) -> product.getStatus() == EcosystemProductStatus.LIVE).count(),
            records.stream().filter((product) -> product.getStatus() == EcosystemProductStatus.ARCHIVED).count(),
            records.stream().filter(this::hasHealthVisibility).count(),
            records.stream().filter((product) -> hasText(product.getRevenueStatus()) || hasText(product.getRevenueNotes())).count(),
            records.stream().filter((product) -> hasText(product.getComplianceStatus())).count(),
            records.stream().filter((product) -> hasText(product.getSecurityStatus())).count(),
            records.stream().filter((product) -> hasText(product.getDeploymentStatus())).count(),
            records.stream().filter((product) -> hasText(product.getRoadmapNotes())).count(),
            records.stream().filter((product) -> hasText(product.getRiskRegister())).count()
        );
    }

    @Transactional
    public EcosystemProductResponse create(EcosystemProductRequest request, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        validate(request);
        String productCode = normalizeCode(request.productCode());
        products.findByProductCodeIgnoreCase(productCode).ifPresent((existing) -> {
            throw new IllegalArgumentException("Product code already exists.");
        });

        EcosystemProduct product = new EcosystemProduct();
        product.setCreatedBy(actor.getDisplayName());
        apply(product, request);
        EcosystemProduct saved = products.saveAndFlush(product);
        auditService.record(actor, MODULE, "ECOSYSTEM_PRODUCT_CREATED", "Created ecosystem product " + saved.getProductCode(), "IMPORTANT");
        return EcosystemProductResponse.from(saved);
    }

    @Transactional
    public EcosystemProductResponse update(UUID id, EcosystemProductRequest request, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
        validate(request);
        EcosystemProduct product = find(id);
        EcosystemProductStatus previousStatus = product.getStatus();

        if (!actor.hasRole(Role.FOUNDER)) {
            ensureDirectorStatusOnlyUpdate(product, request);
            if (request.status() == EcosystemProductStatus.ARCHIVED) throw new ForbiddenOperationException("Only Founder can archive ecosystem products.");
            product.setStatus(request.status());
        } else {
            String nextCode = normalizeCode(request.productCode());
            products.findByProductCodeIgnoreCase(nextCode)
                .filter((existing) -> !existing.getId().equals(product.getId()))
                .ifPresent((existing) -> {
                    throw new IllegalArgumentException("Product code already exists.");
                });
            apply(product, request);
            product.setArchivedAt(product.getStatus() == EcosystemProductStatus.ARCHIVED ? Instant.now() : null);
        }

        EcosystemProduct saved = products.saveAndFlush(product);
        auditService.record(actor, MODULE, "ECOSYSTEM_PRODUCT_UPDATED", "Updated ecosystem product " + saved.getProductCode(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        return EcosystemProductResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        EcosystemProduct product = find(id);
        EcosystemProductStatus previousStatus = product.getStatus();
        if (product.getStatus() != EcosystemProductStatus.ARCHIVED) {
            product.setStatus(EcosystemProductStatus.ARCHIVED);
            product.setArchivedAt(Instant.now());
        }
        auditStatusChange(actor, product, previousStatus, product.getStatus());
        auditService.record(actor, MODULE, "ECOSYSTEM_PRODUCT_ARCHIVED", "Archived ecosystem product " + product.getProductCode(), "WARNING");
    }

    private void apply(EcosystemProduct product, EcosystemProductRequest request) {
        product.setProductName(request.productName().trim());
        product.setProductCode(normalizeCode(request.productCode()));
        product.setStatus(request.status());
        product.setOwner(request.owner().trim());
        product.setDescription(blankToNull(request.description()));
        product.setDomain(blankToNull(request.domain()));
        product.setBackendUrl(blankToNull(request.backendUrl()));
        product.setFrontendUrl(blankToNull(request.frontendUrl()));
        product.setCurrentVersion(blankToNull(request.currentVersion()));
        product.setLaunchStatus(blankToNull(request.launchStatus()));
        product.setRevenueStatus(blankToNull(request.revenueStatus()));
        product.setComplianceStatus(blankToNull(request.complianceStatus()));
        product.setSecurityStatus(blankToNull(request.securityStatus()));
        product.setDeploymentStatus(blankToNull(request.deploymentStatus()));
        product.setHealthNotes(blankToNull(request.healthNotes()));
        product.setRevenueNotes(blankToNull(request.revenueNotes()));
        product.setRoadmapNotes(blankToNull(request.roadmapNotes()));
        product.setLaunchChecklist(blankToNull(request.launchChecklist()));
        product.setRiskRegister(blankToNull(request.riskRegister()));
    }

    private void validate(EcosystemProductRequest request) {
        if (request.productName() == null || request.productName().isBlank()) throw new IllegalArgumentException("Product name is required.");
        if (request.productCode() == null || request.productCode().isBlank()) throw new IllegalArgumentException("Product code is required.");
        if (request.status() == null) throw new IllegalArgumentException("Product status is required.");
        if (request.owner() == null || request.owner().isBlank()) throw new IllegalArgumentException("Product owner is required.");
    }

    private void ensureDirectorStatusOnlyUpdate(EcosystemProduct product, EcosystemProductRequest request) {
        if (!same(request.productName(), product.getProductName())
            || !same(normalizeCode(request.productCode()), product.getProductCode())
            || !same(request.owner(), product.getOwner())
            || !same(request.description(), product.getDescription())
            || !same(request.domain(), product.getDomain())
            || !same(request.backendUrl(), product.getBackendUrl())
            || !same(request.frontendUrl(), product.getFrontendUrl())
            || !same(request.currentVersion(), product.getCurrentVersion())
            || !same(request.launchStatus(), product.getLaunchStatus())
            || !same(request.revenueStatus(), product.getRevenueStatus())
            || !same(request.complianceStatus(), product.getComplianceStatus())
            || !same(request.securityStatus(), product.getSecurityStatus())
            || !same(request.deploymentStatus(), product.getDeploymentStatus())
            || !same(request.healthNotes(), product.getHealthNotes())
            || !same(request.revenueNotes(), product.getRevenueNotes())
            || !same(request.roadmapNotes(), product.getRoadmapNotes())
            || !same(request.launchChecklist(), product.getLaunchChecklist())
            || !same(request.riskRegister(), product.getRiskRegister())) {
            throw new ForbiddenOperationException("Director can update ecosystem product status only.");
        }
    }

    private void auditStatusChange(AppUser actor, EcosystemProduct product, EcosystemProductStatus previousStatus, EcosystemProductStatus newStatus) {
        if (previousStatus != newStatus) {
            auditService.record(actor, MODULE, "ECOSYSTEM_PRODUCT_STATUS_CHANGED", "Changed ecosystem product status from " + previousStatus + " to " + newStatus + " for " + product.getProductCode(), "INFO");
        }
    }

    private EcosystemProduct find(UUID id) {
        return products.findById(id).orElseThrow(() -> new NotFoundException("Ecosystem product not found."));
    }

    private boolean hasHealthVisibility(EcosystemProduct product) {
        return hasText(product.getHealthNotes()) || hasText(product.getSecurityStatus()) || hasText(product.getDeploymentStatus());
    }

    private boolean hasText(String value) { return value != null && !value.isBlank(); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String normalizeCode(String value) { return value == null ? null : value.trim().toUpperCase(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private boolean same(String requested, String current) {
        String left = blankToNull(requested);
        String right = blankToNull(current);
        return left == null ? right == null : left.equals(right);
    }
}
