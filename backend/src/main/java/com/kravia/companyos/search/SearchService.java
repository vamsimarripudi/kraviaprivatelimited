package com.kravia.companyos.search;

import com.kravia.companyos.announcement.Announcement;
import com.kravia.companyos.announcement.AnnouncementAudience;
import com.kravia.companyos.announcement.AnnouncementRepository;
import com.kravia.companyos.announcement.AnnouncementStatus;
import com.kravia.companyos.audit.AuditLog;
import com.kravia.companyos.audit.AuditLogRepository;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.company.CompanyProfile;
import com.kravia.companyos.company.CompanyProfileRepository;
import com.kravia.companyos.compliance.ComplianceItem;
import com.kravia.companyos.compliance.ComplianceItemRepository;
import com.kravia.companyos.contact.CompanyContact;
import com.kravia.companyos.contact.ContactRepository;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.document.DocumentRepository;
import com.kravia.companyos.finance.FinancialRecord;
import com.kravia.companyos.finance.FinancialRecordRepository;
import com.kravia.companyos.meeting.BoardMeeting;
import com.kravia.companyos.meeting.BoardMeetingRepository;
import com.kravia.companyos.product.CompanyProduct;
import com.kravia.companyos.product.ProductRepository;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.task.CompanyTask;
import com.kravia.companyos.task.CompanyTaskRepository;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SearchService {
    private static final int GROUP_LIMIT = 12;
    private static final List<String> RESTRICTED_AUDIT_MODULES = List.of("AUTH", "AUTHENTICATION", "SECURITY", "SETTINGS");

    private final CompanyProfileRepository companyProfiles;
    private final DocumentRepository documents;
    private final BoardMeetingRepository meetings;
    private final FinancialRecordRepository financialRecords;
    private final ComplianceItemRepository complianceItems;
    private final CompanyTaskRepository tasks;
    private final ProductRepository products;
    private final ContactRepository contacts;
    private final AnnouncementRepository announcements;
    private final AuditLogRepository auditLogs;
    private final PermissionService permissions;

    public SearchService(
        CompanyProfileRepository companyProfiles,
        DocumentRepository documents,
        BoardMeetingRepository meetings,
        FinancialRecordRepository financialRecords,
        ComplianceItemRepository complianceItems,
        CompanyTaskRepository tasks,
        ProductRepository products,
        ContactRepository contacts,
        AnnouncementRepository announcements,
        AuditLogRepository auditLogs,
        PermissionService permissions
    ) {
        this.companyProfiles = companyProfiles;
        this.documents = documents;
        this.meetings = meetings;
        this.financialRecords = financialRecords;
        this.complianceItems = complianceItems;
        this.tasks = tasks;
        this.products = products;
        this.contacts = contacts;
        this.announcements = announcements;
        this.auditLogs = auditLogs;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public SearchResponse search(String query, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
        String normalizedQuery = query == null ? "" : query.trim();
        if (normalizedQuery.isBlank()) return new SearchResponse("", Instant.now(), 0, List.of());

        List<SearchGroup> groups = new ArrayList<>();
        addGroup(groups, companyProfileResults(normalizedQuery));
        addGroup(groups, documentResults(normalizedQuery));
        addGroup(groups, meetingResults(normalizedQuery));
        addGroup(groups, financeResults(normalizedQuery));
        addGroup(groups, complianceResults(normalizedQuery));
        addGroup(groups, taskResults(normalizedQuery));
        addGroup(groups, productResults(normalizedQuery));
        addGroup(groups, contactResults(normalizedQuery));
        addGroup(groups, announcementResults(normalizedQuery, actor));
        addGroup(groups, auditResults(normalizedQuery, actor));
        int total = groups.stream().mapToInt(SearchGroup::count).sum();
        return new SearchResponse(normalizedQuery, Instant.now(), total, groups);
    }

    private SearchGroup companyProfileResults(String query) {
        List<SearchResult> results = companyProfiles.findAll().stream()
            .filter(profile -> matches(query, profile.getCompanyName(), profile.getCin(), profile.getPan(), profile.getTan(), profile.getRegisteredOfficeAddress(), profile.getEmail(), profile.getPhone(), profile.getDirectors(), profile.getShareholders(), profile.getCompanyStatus()))
            .sorted(Comparator.comparing(CompanyProfile::getUpdatedAt).reversed())
            .limit(GROUP_LIMIT)
            .map(profile -> result(profile.getId(), value(profile.getCompanyName(), "KRAVIA PRIVATE LIMITED"), "Company profile record", profile.getCompanyStatus(), "/company-profile", profile.getUpdatedAt()))
            .toList();
        return group("COMPANY_PROFILE", "Company Profile", results);
    }

    private SearchGroup documentResults(String query) {
        List<SearchResult> results = documents.search(query, null, null).stream()
            .limit(GROUP_LIMIT)
            .map(document -> result(document.getId(), document.getTitle(), value(document.getDescription(), document.getFileName()), enumText(document.getStatus()), "/documents", document.getUpdatedAt()))
            .toList();
        return group("DOCUMENTS", "Documents", results);
    }

    private SearchGroup meetingResults(String query) {
        List<SearchResult> results = meetings.search(query, null, null).stream()
            .limit(GROUP_LIMIT)
            .map(meeting -> result(meeting.getId(), meeting.getTitle(), enumText(meeting.getMeetingType()) + " meeting", enumText(meeting.getStatus()), "/board-meetings", meeting.getUpdatedAt()))
            .toList();
        return group("BOARD_MEETINGS", "Board Meetings", results);
    }

    private SearchGroup financeResults(String query) {
        List<SearchResult> results = financialRecords.search(query, null, null).stream()
            .limit(GROUP_LIMIT)
            .map(record -> result(record.getId(), "Financial record " + record.getReportingMonth(), value(record.getFounderNotes(), "Monthly financial record"), enumText(record.getStatus()), "/finance", record.getUpdatedAt()))
            .toList();
        return group("FINANCE", "Financial Records", results);
    }

    private SearchGroup complianceResults(String query) {
        List<SearchResult> results = complianceItems.search(query, null, null, null).stream()
            .limit(GROUP_LIMIT)
            .map(item -> result(item.getId(), item.getTitle(), value(item.getDescription(), enumText(item.getCategory())), enumText(item.getStatus()), "/compliance", item.getUpdatedAt()))
            .toList();
        return group("COMPLIANCE", "Compliance Items", results);
    }

    private SearchGroup taskResults(String query) {
        List<SearchResult> results = tasks.search(query, null, null, null, null).stream()
            .limit(GROUP_LIMIT)
            .map(task -> result(task.getId(), task.getTitle(), value(task.getDescription(), value(task.getAssignedTo(), enumText(task.getCategory()))), enumText(task.getStatus()), "/tasks", task.getUpdatedAt()))
            .toList();
        return group("TASKS", "Tasks", results);
    }

    private SearchGroup productResults(String query) {
        List<SearchResult> results = products.search(query, null, null).stream()
            .limit(GROUP_LIMIT)
            .map(product -> result(product.getId(), product.getName(), value(product.getDescription(), value(product.getNextMilestone(), enumText(product.getCategory()))), enumText(product.getStatus()), "/products", product.getUpdatedAt()))
            .toList();
        return group("PRODUCTS", "Products", results);
    }

    private SearchGroup contactResults(String query) {
        List<SearchResult> results = contacts.search(query, null, null).stream()
            .limit(GROUP_LIMIT)
            .map(contact -> result(contact.getId(), contact.getName(), value(contact.getOrganization(), value(contact.getEmail(), enumText(contact.getCategory()))), enumText(contact.getStatus()), "/contacts", contact.getUpdatedAt()))
            .toList();
        return group("CONTACTS", "Contacts & Partners", results);
    }

    private SearchGroup announcementResults(String query, AppUser actor) {
        List<SearchResult> results = announcements.findAll().stream()
            .filter(announcement -> canViewAnnouncement(announcement, actor))
            .filter(announcement -> matches(query, announcement.getTitle(), announcement.getMessage(), announcement.getCreatedBy(), enumText(announcement.getAudience()), enumText(announcement.getStatus())))
            .sorted(Comparator.comparing(Announcement::getUpdatedAt).reversed())
            .limit(GROUP_LIMIT)
            .map(announcement -> result(announcement.getId(), announcement.getTitle(), value(announcement.getMessage(), enumText(announcement.getAudience())), enumText(announcement.getStatus()), "/announcements", announcement.getUpdatedAt()))
            .toList();
        return group("ANNOUNCEMENTS", "Announcements", results);
    }

    private SearchGroup auditResults(String query, AppUser actor) {
        if (!actor.hasRole(Role.FOUNDER) && !actor.hasRole(Role.DIRECTOR)) return group("AUDIT_LOGS", "Audit Logs", List.of());
        List<SearchResult> results = auditLogs.findAll().stream()
            .filter(log -> canViewAuditLog(actor, log))
            .filter(log -> matches(query, log.getActorEmail(), log.getActorName(), log.getActorRoles(), log.getModule(), log.getAction(), log.getDescription(), log.getSeverity()))
            .sorted(Comparator.comparing(AuditLog::getCreatedAt).reversed())
            .limit(GROUP_LIMIT)
            .map(log -> result(log.getId(), log.getAction(), log.getDescription(), log.getSeverity(), "/audit-logs", log.getCreatedAt()))
            .toList();
        return group("AUDIT_LOGS", "Audit Logs", results);
    }

    private boolean canViewAnnouncement(Announcement announcement, AppUser actor) {
        if (actor.hasRole(Role.FOUNDER) || actor.hasRole(Role.DIRECTOR)) return true;
        boolean visibleStatus = announcement.getStatus() == AnnouncementStatus.PUBLISHED || announcement.getStatus() == AnnouncementStatus.PINNED;
        boolean visibleAudience = announcement.getAudience() == AnnouncementAudience.VIEWER || announcement.getAudience() == AnnouncementAudience.EVERYONE;
        return visibleStatus && visibleAudience;
    }

    private boolean canViewAuditLog(AppUser actor, AuditLog log) {
        if (actor.hasRole(Role.FOUNDER)) return true;
        if (!actor.hasRole(Role.DIRECTOR)) return false;
        return RESTRICTED_AUDIT_MODULES.stream().noneMatch(module -> module.equalsIgnoreCase(log.getModule()));
    }

    private void addGroup(List<SearchGroup> groups, SearchGroup group) {
        if (!group.results().isEmpty()) groups.add(group);
    }

    private SearchGroup group(String module, String label, List<SearchResult> results) {
        return new SearchGroup(module, label, results.size(), results);
    }

    private SearchResult result(UUID id, String title, String description, String status, String route, Instant updatedAt) {
        return new SearchResult(id, value(title, "Untitled record"), value(description, "No information has been added yet."), value(status, "No status"), route, updatedAt);
    }

    private boolean matches(String query, Object... values) {
        String needle = query.toLowerCase(Locale.ROOT);
        for (Object value : values) {
            if (value != null && value.toString().toLowerCase(Locale.ROOT).contains(needle)) return true;
        }
        return false;
    }

    private String value(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
    private String enumText(Object value) { return value == null ? "" : value.toString(); }
}
