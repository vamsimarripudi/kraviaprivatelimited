package com.kravia.companyos.contact;

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
public class ContactService {
    private static final String MODULE = "CONTACTS_PARTNERS";
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final ContactRepository contacts;
    private final PermissionService permissions;
    private final AuditService auditService;

    public ContactService(ContactRepository contacts, PermissionService permissions, AuditService auditService) {
        this.contacts = contacts;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<ContactResponse> list(String query, ContactCategory category, ContactStatus status, AppUser actor) {
        requireViewer(actor);
        return contacts.search(normalize(query), category, status).stream().map(ContactResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ContactResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return ContactResponse.from(find(id));
    }

    @Transactional
    public ContactResponse create(ContactRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        if (request.status() == ContactStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        CompanyContact contact = new CompanyContact();
        contact.setCreatedBy(actor.getDisplayName());
        apply(contact, request);
        if (contact.getStatus() == ContactStatus.ARCHIVED) contact.setArchivedAt(Instant.now());
        CompanyContact saved = contacts.saveAndFlush(contact);
        auditService.record(actor, MODULE, "CONTACT_CREATED", "Created contact " + saved.getName(), "IMPORTANT");
        return ContactResponse.from(saved);
    }

    @Transactional
    public ContactResponse update(UUID id, ContactRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        CompanyContact contact = find(id);
        ensureEditable(contact);
        ContactStatus previousStatus = contact.getStatus();
        if (request.status() == ContactStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        apply(contact, request);
        if (contact.getStatus() == ContactStatus.ARCHIVED) contact.setArchivedAt(Instant.now());
        CompanyContact saved = contacts.saveAndFlush(contact);
        auditService.record(actor, MODULE, "CONTACT_UPDATED", "Updated contact " + saved.getName(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        return ContactResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        CompanyContact contact = find(id);
        ContactStatus previousStatus = contact.getStatus();
        if (contact.getStatus() != ContactStatus.ARCHIVED) {
            contact.setStatus(ContactStatus.ARCHIVED);
            contact.setArchivedAt(Instant.now());
        }
        auditStatusChange(actor, contact, previousStatus, contact.getStatus());
        auditService.record(actor, MODULE, "CONTACT_ARCHIVED", "Archived contact " + contact.getName(), "WARNING");
    }

    private void apply(CompanyContact contact, ContactRequest request) {
        contact.setName(request.name().trim());
        contact.setOrganization(blankToNull(request.organization()));
        contact.setRole(blankToNull(request.role()));
        contact.setCategory(request.category());
        contact.setPhone(blankToNull(request.phone()));
        contact.setEmail(blankToNull(request.email()));
        contact.setNotes(blankToNull(request.notes()));
        contact.setRelatedDocumentId(request.relatedDocumentId());
        contact.setRelatedTaskId(request.relatedTaskId());
        contact.setLastContactedDate(request.lastContactedDate());
        contact.setNextFollowUpDate(request.nextFollowUpDate());
        contact.setStatus(request.status());
    }

    private void validateRequest(ContactRequest request) {
        if (request.name() == null || request.name().isBlank()) throw new IllegalArgumentException("Contact name is required.");
        if (request.category() == null) throw new IllegalArgumentException("Contact category is required.");
        if (request.status() == null) throw new IllegalArgumentException("Contact status is required.");
        boolean hasPhone = request.phone() != null && !request.phone().isBlank();
        boolean hasEmail = request.email() != null && !request.email().isBlank();
        if (!hasPhone && !hasEmail) throw new IllegalArgumentException("At least one contact method is required.");
        if (hasEmail && !EMAIL_PATTERN.matcher(request.email().trim()).matches()) throw new IllegalArgumentException("Contact email must be valid.");
        if (request.status() == ContactStatus.FOLLOW_UP_NEEDED && request.nextFollowUpDate() == null) throw new IllegalArgumentException("Next follow-up date is required when follow-up is needed.");
    }

    private void ensureEditable(CompanyContact contact) {
        if (contact.getStatus() == ContactStatus.ARCHIVED) throw new ForbiddenOperationException("Archived contacts cannot be edited.");
    }

    private void auditStatusChange(AppUser actor, CompanyContact contact, ContactStatus previousStatus, ContactStatus newStatus) {
        if (previousStatus != newStatus) auditService.record(actor, MODULE, "CONTACT_STATUS_CHANGED", "Changed contact status from " + previousStatus + " to " + newStatus + " for " + contact.getName(), "INFO");
    }

    private CompanyContact find(UUID id) {
        return contacts.findById(id).orElseThrow(() -> new NotFoundException("Contact not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}