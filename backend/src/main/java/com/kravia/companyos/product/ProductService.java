package com.kravia.companyos.product;

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
public class ProductService {
    private static final String MODULE = "PRODUCTS_PORTFOLIO";
    private static final Set<ProductStatus> ACTIVE_STATUSES = Set.of(
        ProductStatus.IDEA,
        ProductStatus.PLANNING,
        ProductStatus.DESIGN,
        ProductStatus.DEVELOPMENT,
        ProductStatus.TESTING,
        ProductStatus.LAUNCH_READY,
        ProductStatus.LIVE
    );

    private final ProductRepository products;
    private final PermissionService permissions;
    private final AuditService auditService;

    public ProductService(ProductRepository products, PermissionService permissions, AuditService auditService) {
        this.products = products;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ProductResponse> list(String query, ProductStatus status, String developmentStage, AppUser actor) {
        requireViewer(actor);
        return products.search(normalize(query), status, normalize(developmentStage)).stream().map(ProductResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ProductResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return ProductResponse.from(find(id));
    }

    @Transactional
    public ProductResponse create(ProductRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        if (request.status() == ProductStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        CompanyProduct product = new CompanyProduct();
        product.setCreatedBy(actor.getDisplayName());
        apply(product, request);
        if (product.getStatus() == ProductStatus.ARCHIVED) product.setArchivedAt(Instant.now());
        CompanyProduct saved = products.saveAndFlush(product);
        auditService.record(actor, MODULE, "PRODUCT_CREATED", "Created product " + saved.getName(), "IMPORTANT");
        return ProductResponse.from(saved);
    }

    @Transactional
    public ProductResponse update(UUID id, ProductRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        CompanyProduct product = find(id);
        ensureEditable(product);
        ProductStatus previousStatus = product.getStatus();
        if (request.status() == ProductStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        apply(product, request);
        if (product.getStatus() == ProductStatus.ARCHIVED) product.setArchivedAt(Instant.now());
        CompanyProduct saved = products.saveAndFlush(product);
        auditService.record(actor, MODULE, "PRODUCT_UPDATED", "Updated product " + saved.getName(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        return ProductResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        CompanyProduct product = find(id);
        ProductStatus previousStatus = product.getStatus();
        if (product.getStatus() != ProductStatus.ARCHIVED) {
            product.setStatus(ProductStatus.ARCHIVED);
            product.setArchivedAt(Instant.now());
        }
        auditStatusChange(actor, product, previousStatus, product.getStatus());
        auditService.record(actor, MODULE, "PRODUCT_ARCHIVED", "Archived product " + product.getName(), "WARNING");
    }

    private void apply(CompanyProduct product, ProductRequest request) {
        product.setName(request.name().trim());
        product.setCategory(request.category());
        product.setDescription(blankToNull(request.description()));
        product.setStatus(request.status());
        product.setDevelopmentStage(request.developmentStage().trim());
        product.setLaunchReadinessPercentage(request.launchReadinessPercentage());
        product.setTargetUsers(blankToNull(request.targetUsers()));
        product.setPricingNotes(blankToNull(request.pricingNotes()));
        product.setRevenueNotes(blankToNull(request.revenueNotes()));
        product.setKeyFeatures(blankToNull(request.keyFeatures()));
        product.setPendingWork(blankToNull(request.pendingWork()));
        product.setRisks(blankToNull(request.risks()));
        product.setNextMilestone(blankToNull(request.nextMilestone()));
        product.setResponsiblePerson(blankToNull(request.responsiblePerson()));
    }

    private void validateRequest(ProductRequest request) {
        if (request.name() == null || request.name().isBlank()) throw new IllegalArgumentException("Product name is required.");
        if (request.category() == null) throw new IllegalArgumentException("Product category is required.");
        if (request.status() == null) throw new IllegalArgumentException("Product status is required.");
        if (request.developmentStage() == null || request.developmentStage().isBlank()) throw new IllegalArgumentException("Development stage is required.");
        if (request.launchReadinessPercentage() == null || request.launchReadinessPercentage() < 0 || request.launchReadinessPercentage() > 100) throw new IllegalArgumentException("Launch readiness must be between 0 and 100.");
        if (ACTIVE_STATUSES.contains(request.status()) && (request.responsiblePerson() == null || request.responsiblePerson().isBlank())) throw new IllegalArgumentException("Responsible person is required when product is active.");
    }

    private void ensureEditable(CompanyProduct product) {
        if (product.getStatus() == ProductStatus.ARCHIVED) throw new ForbiddenOperationException("Archived products cannot be edited.");
    }

    private void auditStatusChange(AppUser actor, CompanyProduct product, ProductStatus previousStatus, ProductStatus newStatus) {
        if (previousStatus != newStatus) auditService.record(actor, MODULE, "PRODUCT_STATUS_CHANGED", "Changed product status from " + previousStatus + " to " + newStatus + " for " + product.getName(), "INFO");
    }

    private CompanyProduct find(UUID id) {
        return products.findById(id).orElseThrow(() -> new NotFoundException("Product not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}