package com.kravia.companyos.sales;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SalesService {
    private static final String MODULE = "SALES_PIPELINE";
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final SalesLeadRepository leads;
    private final SalesCustomerRepository customers;
    private final PermissionService permissions;
    private final AuditService auditService;

    public SalesService(SalesLeadRepository leads, SalesCustomerRepository customers, PermissionService permissions, AuditService auditService) {
        this.leads = leads;
        this.customers = customers;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<SalesLeadResponse> listLeads(String query, LeadStage stage, LeadPriority priority, AppUser actor) {
        requireViewer(actor);
        return leads.search(normalize(query), stage, priority).stream().map(SalesLeadResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public SalesLeadResponse getLead(UUID id, AppUser actor) {
        requireViewer(actor);
        return SalesLeadResponse.from(findLead(id));
    }

    @Transactional
    public SalesLeadResponse createLead(SalesLeadRequest request, AppUser actor) {
        requireEditor(actor);
        validateLead(request);
        if (request.stage() == LeadStage.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        SalesLead lead = new SalesLead();
        lead.setCreatedBy(actor.getDisplayName());
        applyLead(lead, request);
        if (lead.getStage() == LeadStage.ARCHIVED) lead.setArchivedAt(Instant.now());
        SalesLead saved = leads.saveAndFlush(lead);
        auditService.record(actor, MODULE, "SALES_LEAD_CREATED", "Created sales lead " + saved.getLeadName(), "IMPORTANT");
        return SalesLeadResponse.from(saved);
    }

    @Transactional
    public SalesLeadResponse updateLead(UUID id, SalesLeadRequest request, AppUser actor) {
        requireEditor(actor);
        validateLead(request);
        SalesLead lead = findLead(id);
        ensureLeadEditable(lead);
        LeadStage previousStage = lead.getStage();
        if (request.stage() == LeadStage.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        applyLead(lead, request);
        if (lead.getStage() == LeadStage.ARCHIVED) lead.setArchivedAt(Instant.now());
        SalesLead saved = leads.saveAndFlush(lead);
        auditService.record(actor, MODULE, "SALES_LEAD_UPDATED", "Updated sales lead " + saved.getLeadName(), "IMPORTANT");
        auditLeadStageChange(actor, saved, previousStage, saved.getStage());
        return SalesLeadResponse.from(saved);
    }

    @Transactional
    public void archiveLead(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        SalesLead lead = findLead(id);
        LeadStage previousStage = lead.getStage();
        if (lead.getStage() != LeadStage.ARCHIVED) {
            lead.setStage(LeadStage.ARCHIVED);
            lead.setArchivedAt(Instant.now());
        }
        auditLeadStageChange(actor, lead, previousStage, lead.getStage());
        auditService.record(actor, MODULE, "SALES_LEAD_ARCHIVED", "Archived sales lead " + lead.getLeadName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public List<SalesCustomerResponse> listCustomers(String query, String product, String subscriptionStatus, AppUser actor) {
        requireViewer(actor);
        return customers.search(normalize(query), normalize(product), normalize(subscriptionStatus)).stream().map(SalesCustomerResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public SalesCustomerResponse getCustomer(UUID id, AppUser actor) {
        requireViewer(actor);
        return SalesCustomerResponse.from(findCustomer(id));
    }

    @Transactional
    public SalesCustomerResponse createCustomer(SalesCustomerRequest request, AppUser actor) {
        requireEditor(actor);
        validateCustomer(request);
        SalesCustomer customer = new SalesCustomer();
        customer.setCreatedBy(actor.getDisplayName());
        applyCustomer(customer, request);
        SalesCustomer saved = customers.saveAndFlush(customer);
        auditService.record(actor, MODULE, "SALES_CUSTOMER_CREATED", "Created customer " + saved.getCustomerName(), "IMPORTANT");
        return SalesCustomerResponse.from(saved);
    }

    @Transactional
    public SalesCustomerResponse updateCustomer(UUID id, SalesCustomerRequest request, AppUser actor) {
        requireEditor(actor);
        validateCustomer(request);
        SalesCustomer customer = findCustomer(id);
        ensureCustomerEditable(customer);
        applyCustomer(customer, request);
        SalesCustomer saved = customers.saveAndFlush(customer);
        auditService.record(actor, MODULE, "SALES_CUSTOMER_UPDATED", "Updated customer " + saved.getCustomerName(), "IMPORTANT");
        return SalesCustomerResponse.from(saved);
    }

    @Transactional
    public void archiveCustomer(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        SalesCustomer customer = findCustomer(id);
        if (customer.getArchivedAt() == null) customer.setArchivedAt(Instant.now());
        auditService.record(actor, MODULE, "SALES_CUSTOMER_ARCHIVED", "Archived customer " + customer.getCustomerName(), "WARNING");
    }

    private void applyLead(SalesLead lead, SalesLeadRequest request) {
        lead.setLeadName(request.leadName().trim());
        lead.setOrganizationName(request.organizationName().trim());
        lead.setContactPerson(blankToNull(request.contactPerson()));
        lead.setPhone(blankToNull(request.phone()));
        lead.setEmail(blankToNull(request.email()));
        lead.setProductInterest(request.productInterest().trim());
        lead.setLeadSource(blankToNull(request.leadSource()));
        lead.setStage(request.stage());
        lead.setPriority(request.priority());
        lead.setAssignedPerson(blankToNull(request.assignedPerson()));
        lead.setLastContactedDate(request.lastContactedDate());
        lead.setNextFollowUpDate(request.nextFollowUpDate());
        lead.setNotes(blankToNull(request.notes()));
    }

    private void applyCustomer(SalesCustomer customer, SalesCustomerRequest request) {
        customer.setCustomerName(request.customerName().trim());
        customer.setOrganizationType(blankToNull(request.organizationType()));
        customer.setProduct(request.product().trim());
        customer.setPlan(blankToNull(request.plan()));
        customer.setSubscriptionStatus(blankToNull(request.subscriptionStatus()));
        customer.setStartDate(request.startDate());
        customer.setRenewalDate(request.renewalDate());
        customer.setPaymentStatus(blankToNull(request.paymentStatus()));
        customer.setSupportStatus(blankToNull(request.supportStatus()));
        customer.setOnboardingStatus(blankToNull(request.onboardingStatus()));
        customer.setNotes(blankToNull(request.notes()));
    }

    private void validateLead(SalesLeadRequest request) {
        if (request.leadName() == null || request.leadName().isBlank()) throw new IllegalArgumentException("Lead name is required.");
        if (request.organizationName() == null || request.organizationName().isBlank()) throw new IllegalArgumentException("Organization name is required.");
        if (request.productInterest() == null || request.productInterest().isBlank()) throw new IllegalArgumentException("Product interest is required.");
        if (request.stage() == null) throw new IllegalArgumentException("Lead stage is required.");
        if (request.priority() == null) throw new IllegalArgumentException("Lead priority is required.");
        if (request.email() != null && !request.email().isBlank() && !EMAIL_PATTERN.matcher(request.email().trim()).matches()) throw new IllegalArgumentException("Lead email must be valid.");
    }

    private void validateCustomer(SalesCustomerRequest request) {
        if (request.customerName() == null || request.customerName().isBlank()) throw new IllegalArgumentException("Customer name is required.");
        if (request.product() == null || request.product().isBlank()) throw new IllegalArgumentException("Customer product is required.");
    }

    private void ensureLeadEditable(SalesLead lead) {
        if (lead.getStage() == LeadStage.ARCHIVED) throw new ForbiddenOperationException("Archived leads cannot be edited.");
    }

    private void ensureCustomerEditable(SalesCustomer customer) {
        if (customer.getArchivedAt() != null) throw new ForbiddenOperationException("Archived customers cannot be edited.");
    }

    private void auditLeadStageChange(AppUser actor, SalesLead lead, LeadStage previousStage, LeadStage newStage) {
        if (previousStage != newStage) auditService.record(actor, MODULE, "SALES_LEAD_STAGE_CHANGED", "Changed lead stage from " + previousStage + " to " + newStage + " for " + lead.getLeadName(), "INFO");
    }

    private SalesLead findLead(UUID id) {
        return leads.findById(id).orElseThrow(() -> new NotFoundException("Sales lead not found."));
    }

    private SalesCustomer findCustomer(UUID id) {
        return customers.findById(id).orElseThrow(() -> new NotFoundException("Sales customer not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
