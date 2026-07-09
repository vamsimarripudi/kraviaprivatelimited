package com.kravia.companyos.report;

import com.kravia.companyos.announcement.Announcement;
import com.kravia.companyos.announcement.AnnouncementRepository;
import com.kravia.companyos.audit.AuditLog;
import com.kravia.companyos.audit.AuditLogRepository;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.BaseEntity;
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
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReportService {
    private static final String MODULE = "REPORTS";
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
    private final AuditService auditService;

    public ReportService(
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
        PermissionService permissions,
        AuditService auditService
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
        this.auditService = auditService;
    }

    @Transactional
    public ReportResponse companySummary(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        List<CompanyProfile> profileRows = filtered(companyProfiles.findAll(), this::createdDate, filters, "COMPANY_PROFILE");
        List<DocumentRecord> documentRows = filtered(documents.findAll(), this::createdDate, filters, "DOCUMENTS");
        List<BoardMeeting> meetingRows = filtered(meetings.findAll(), meeting -> meeting.getMeetingDate().toLocalDate(), filters, "BOARD_MEETINGS");
        List<FinancialRecord> financeRows = filtered(financialRecords.findAll(), this::reportingDate, filters, "FINANCE");
        List<ComplianceItem> complianceRows = filtered(complianceItems.findAll(), this::complianceDate, filters, "COMPLIANCE");
        List<CompanyTask> taskRows = filtered(tasks.findAll(), this::taskDate, filters, "TASKS");
        List<CompanyProduct> productRows = filtered(products.findAll(), this::createdDate, filters, "PRODUCTS");
        List<CompanyContact> contactRows = filtered(contacts.findAll(), this::createdDate, filters, "CONTACTS");
        List<Announcement> announcementRows = filtered(announcements.findAll(), this::createdDate, filters, "ANNOUNCEMENTS");

        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(summaryRow("Company Profile", profileRows.size(), lastUpdated(profileRows)));
        rows.add(summaryRow("Documents", documentRows.size(), lastUpdated(documentRows)));
        rows.add(summaryRow("Board Meetings", meetingRows.size(), lastUpdated(meetingRows)));
        rows.add(summaryRow("Financial Records", financeRows.size(), lastUpdated(financeRows)));
        rows.add(summaryRow("Compliance Items", complianceRows.size(), lastUpdated(complianceRows)));
        rows.add(summaryRow("Company Tasks", taskRows.size(), lastUpdated(taskRows)));
        rows.add(summaryRow("Products", productRows.size(), lastUpdated(productRows)));
        rows.add(summaryRow("Contacts", contactRows.size(), lastUpdated(contactRows)));
        rows.add(summaryRow("Announcements", announcementRows.size(), lastUpdated(announcementRows)));

        int totalRecords = profileRows.size() + documentRows.size() + meetingRows.size() + financeRows.size() + complianceRows.size() + taskRows.size() + productRows.size() + contactRows.size() + announcementRows.size();
        return build(
            "company-summary",
            "Company Summary Report",
            "Executive overview generated from current KRAVIA Company OS records.",
            filters,
            List.of(metric("Total Records", String.valueOf(totalRecords), "neutral"), metric("Open Tasks", countOpenTasks(taskRows), "warning"), metric("Compliance Due", countOpenCompliance(complianceRows), "warning")),
            List.of(section("Workspace Coverage", List.of("Module", "Records", "Last Updated"), rows)),
            actor
        );
    }

    @Transactional
    public ReportResponse financialSummary(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        List<FinancialRecord> rows = filtered(financialRecords.findAll(), this::reportingDate, filters, "FINANCE").stream()
            .sorted(Comparator.comparing(FinancialRecord::getReportingMonth, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
        BigDecimal revenue = sum(rows, FinancialRecord::getRevenue);
        BigDecimal expenses = sum(rows, FinancialRecord::getExpenses);
        BigDecimal profit = sum(rows, FinancialRecord::getProfitOrLoss);
        BigDecimal netGst = sum(rows, FinancialRecord::getNetGstPosition);
        List<Map<String, String>> tableRows = rows.stream().map(record -> row(
            "Reporting Month", text(record.getReportingMonth()),
            "Revenue", money(record.getRevenue()),
            "Expenses", money(record.getExpenses()),
            "Profit / Loss", money(record.getProfitOrLoss()),
            "Cash Balance", money(record.getCashBalance()),
            "Net GST", money(record.getNetGstPosition()),
            "Status", enumText(record.getStatus()),
            "Updated", instant(record.getUpdatedAt())
        )).toList();
        return build(
            "financial-summary",
            "Financial Summary Report",
            "Founder-level financial totals from stored monthly financial records.",
            filters,
            List.of(metric("Records", rows.size(), "neutral"), metric("Revenue", money(revenue), "positive"), metric("Expenses", money(expenses), "neutral"), metric("Profit / Loss", money(profit), profit.signum() >= 0 ? "positive" : "critical"), metric("Net GST", money(netGst), netGst.signum() >= 0 ? "warning" : "positive")),
            List.of(section("Monthly Financial Records", List.of("Reporting Month", "Revenue", "Expenses", "Profit / Loss", "Cash Balance", "Net GST", "Status", "Updated"), tableRows)),
            actor
        );
    }

    @Transactional
    public ReportResponse profitLoss(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        List<FinancialRecord> rows = filtered(financialRecords.findAll(), this::reportingDate, filters, "FINANCE").stream()
            .sorted(Comparator.comparing(FinancialRecord::getReportingMonth, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
        BigDecimal profit = sum(rows, FinancialRecord::getProfitOrLoss);
        List<Map<String, String>> tableRows = rows.stream().map(record -> row(
            "Reporting Month", text(record.getReportingMonth()),
            "Revenue", money(record.getRevenue()),
            "Expenses", money(record.getExpenses()),
            "Profit / Loss", money(record.getProfitOrLoss()),
            "Status", enumText(record.getStatus())
        )).toList();
        return build(
            "profit-loss",
            "Profit & Loss Report",
            "Revenue minus expenses, calculated from stored monthly financial records.",
            filters,
            List.of(metric("Records", rows.size(), "neutral"), metric("Total Profit / Loss", money(profit), profit.signum() >= 0 ? "positive" : "critical")),
            List.of(section("Profit & Loss by Month", List.of("Reporting Month", "Revenue", "Expenses", "Profit / Loss", "Status"), tableRows)),
            actor
        );
    }

    @Transactional
    public ReportResponse boardMeetings(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        List<BoardMeeting> rows = filtered(meetings.findAll(), meeting -> meeting.getMeetingDate().toLocalDate(), filters, "BOARD_MEETINGS").stream()
            .sorted(Comparator.comparing(BoardMeeting::getMeetingDate).reversed())
            .toList();
        List<Map<String, String>> tableRows = rows.stream().map(meeting -> row(
            "Meeting", meeting.getTitle(),
            "Date", meeting.getMeetingDate().toString(),
            "Type", enumText(meeting.getMeetingType()),
            "Status", enumText(meeting.getStatus()),
            "Agenda Items", String.valueOf(meeting.getAgendaItems().size()),
            "Decisions", String.valueOf(meeting.getDecisions().size()),
            "Action Items", String.valueOf(meeting.getActionItems().size()),
            "Updated", instant(meeting.getUpdatedAt())
        )).toList();
        return build("board-meetings", "Board Meeting Report", "Board and founder meeting records with decisions and action coverage.", filters, List.of(metric("Meetings", rows.size(), "neutral"), metric("Completed", rows.stream().filter(meeting -> "COMPLETED".equals(enumText(meeting.getStatus()))).count(), "positive")), List.of(section("Meeting Records", List.of("Meeting", "Date", "Type", "Status", "Agenda Items", "Decisions", "Action Items", "Updated"), tableRows)), actor);
    }

    @Transactional
    public ReportResponse compliance(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<ComplianceItem> rows = filtered(complianceItems.findAll(), this::complianceDate, filters, "COMPLIANCE").stream()
            .sorted(Comparator.comparing(this::complianceDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        long overdue = rows.stream().filter(item -> isComplianceOverdue(item, today)).count();
        List<Map<String, String>> tableRows = rows.stream().map(item -> row(
            "Title", item.getTitle(),
            "Category", enumText(item.getCategory()),
            "Status", enumText(item.getStatus()),
            "Priority", enumText(item.getPriority()),
            "Due Date", date(item.getDueDate()),
            "Responsible", text(item.getResponsiblePerson()),
            "Updated", instant(item.getUpdatedAt())
        )).toList();
        return build("compliance", "Compliance Report", "Compliance register filtered by due date, status, priority, and ownership.", filters, List.of(metric("Items", rows.size(), "neutral"), metric("Overdue", overdue, overdue > 0 ? "critical" : "positive")), List.of(section("Compliance Items", List.of("Title", "Category", "Status", "Priority", "Due Date", "Responsible", "Updated"), tableRows)), actor);
    }

    @Transactional
    public ReportResponse tasks(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<CompanyTask> rows = filtered(tasks.findAll(), this::taskDate, filters, "TASKS").stream()
            .sorted(Comparator.comparing(this::taskDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        long overdue = rows.stream().filter(task -> isTaskOverdue(task, today)).count();
        long done = rows.stream().filter(task -> "DONE".equals(enumText(task.getStatus()))).count();
        List<Map<String, String>> tableRows = rows.stream().map(task -> row(
            "Task", task.getTitle(),
            "Category", enumText(task.getCategory()),
            "Assignee", text(task.getAssignedTo()),
            "Priority", enumText(task.getPriority()),
            "Status", enumText(task.getStatus()),
            "Due Date", date(task.getDueDate()),
            "Updated", instant(task.getUpdatedAt())
        )).toList();
        return build("tasks", "Task Report", "Company task register with owners, due dates, and completion status.", filters, List.of(metric("Tasks", rows.size(), "neutral"), metric("Overdue", overdue, overdue > 0 ? "critical" : "positive"), metric("Done", done, "positive")), List.of(section("Company Tasks", List.of("Task", "Category", "Assignee", "Priority", "Status", "Due Date", "Updated"), tableRows)), actor);
    }

    @Transactional
    public ReportResponse products(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        List<CompanyProduct> rows = filtered(products.findAll(), this::createdDate, filters, "PRODUCTS").stream()
            .sorted(Comparator.comparing(CompanyProduct::getUpdatedAt).reversed())
            .toList();
        long launchReady = rows.stream().filter(product -> "LAUNCH_READY".equals(enumText(product.getStatus()))).count();
        long withRisks = rows.stream().filter(product -> !blank(product.getRisks())).count();
        List<Map<String, String>> tableRows = rows.stream().map(product -> row(
            "Product", product.getName(),
            "Category", enumText(product.getCategory()),
            "Status", enumText(product.getStatus()),
            "Stage", text(product.getDevelopmentStage()),
            "Launch Readiness", String.valueOf(product.getLaunchReadinessPercentage()) + "%",
            "Responsible", text(product.getResponsiblePerson()),
            "Risks", blank(product.getRisks()) ? "No information has been added yet." : "Recorded",
            "Updated", instant(product.getUpdatedAt())
        )).toList();
        return build("products", "Product Status Report", "Product portfolio status, launch readiness, owners, and risk visibility.", filters, List.of(metric("Products", rows.size(), "neutral"), metric("Launch Ready", launchReady, "positive"), metric("With Risks", withRisks, withRisks > 0 ? "warning" : "positive")), List.of(section("Products", List.of("Product", "Category", "Status", "Stage", "Launch Readiness", "Responsible", "Risks", "Updated"), tableRows)), actor);
    }

    @Transactional
    public ReportResponse documents(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        List<DocumentRecord> rows = filtered(documents.findAll(), this::createdDate, filters, "DOCUMENTS").stream()
            .sorted(Comparator.comparing(DocumentRecord::getUpdatedAt).reversed())
            .toList();
        long active = rows.stream().filter(document -> "ACTIVE".equals(enumText(document.getStatus()))).count();
        List<Map<String, String>> tableRows = rows.stream().map(document -> row(
            "Document", document.getTitle(),
            "Category", enumText(document.getCategory()),
            "Status", enumText(document.getStatus()),
            "File Type", text(document.getFileType()),
            "Version", String.valueOf(document.getVersion()),
            "Uploaded By", text(document.getUploadedBy()),
            "Updated", instant(document.getUpdatedAt())
        )).toList();
        return build("documents", "Document Report", "Document vault inventory generated from stored document metadata.", filters, List.of(metric("Documents", rows.size(), "neutral"), metric("Active", active, "positive")), List.of(section("Documents", List.of("Document", "Category", "Status", "File Type", "Version", "Uploaded By", "Updated"), tableRows)), actor);
    }

    @Transactional
    public ReportResponse contacts(ReportFilters filters, AppUser actor) {
        requireReportViewer(actor);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<CompanyContact> rows = filtered(contacts.findAll(), this::contactDate, filters, "CONTACTS").stream()
            .sorted(Comparator.comparing(this::contactDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        long followUpsDue = rows.stream().filter(contact -> isFollowUpDue(contact, today)).count();
        List<Map<String, String>> tableRows = rows.stream().map(contact -> row(
            "Name", contact.getName(),
            "Organization", text(contact.getOrganization()),
            "Role", text(contact.getRole()),
            "Category", enumText(contact.getCategory()),
            "Status", enumText(contact.getStatus()),
            "Next Follow-up", date(contact.getNextFollowUpDate()),
            "Updated", instant(contact.getUpdatedAt())
        )).toList();
        return build("contacts", "Contact Report", "Contacts and partners with relationship status and follow-up visibility.", filters, List.of(metric("Contacts", rows.size(), "neutral"), metric("Follow-ups Due", followUpsDue, followUpsDue > 0 ? "warning" : "positive")), List.of(section("Contacts & Partners", List.of("Name", "Organization", "Role", "Category", "Status", "Next Follow-up", "Updated"), tableRows)), actor);
    }

    @Transactional
    public ReportResponse activity(ReportFilters filters, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
        List<AuditLog> rows = auditLogs.findAll().stream()
            .filter(log -> canViewAuditLog(actor, log))
            .filter(log -> inRange(log.getCreatedAt(), filters))
            .filter(log -> activityModuleMatches(log.getModule(), filters))
            .sorted(Comparator.comparing(AuditLog::getCreatedAt).reversed())
            .toList();
        long important = rows.stream().filter(log -> "IMPORTANT".equalsIgnoreCase(log.getSeverity())).count();
        long warnings = rows.stream().filter(log -> "WARNING".equalsIgnoreCase(log.getSeverity())).count();
        List<Map<String, String>> tableRows = rows.stream().map(log -> row(
            "Date", instant(log.getCreatedAt()),
            "Actor", log.getActorName(),
            "Module", log.getModule(),
            "Action", log.getAction(),
            "Severity", log.getSeverity(),
            "Description", log.getDescription()
        )).toList();
        return build("activity", "Activity Report", "Audit activity generated from recorded system actions.", filters, List.of(metric("Events", rows.size(), "neutral"), metric("Important", important, "warning"), metric("Warnings", warnings, warnings > 0 ? "critical" : "positive")), List.of(section("Activity Log", List.of("Date", "Actor", "Module", "Action", "Severity", "Description"), tableRows)), actor);
    }

    private ReportResponse build(String key, String title, String description, ReportFilters filters, List<ReportMetric> metrics, List<ReportSection> sections, AppUser actor) {
        auditService.record(actor, MODULE, "REPORT_GENERATED", "Generated " + title, "INFO");
        return new ReportResponse(key, title, description, Instant.now(), filters, metrics, sections, false, false);
    }

    private void requireReportViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }

    private <T> List<T> filtered(List<T> records, Function<T, LocalDate> dateResolver, ReportFilters filters, String module) {
        if (!moduleMatches(module, filters)) return List.of();
        return records.stream().filter(record -> inRange(dateResolver.apply(record), filters)).toList();
    }

    private boolean moduleMatches(String module, ReportFilters filters) {
        if (filters == null || blank(filters.module())) return true;
        String actual = normalize(module);
        String requested = normalize(filters.module());
        return moduleAliases(requested).contains(actual) || moduleAliases(actual).contains(requested);
    }

    private List<String> moduleAliases(String module) {
        return switch (normalize(module)) {
            case "DOCUMENTS", "DOCUMENT_VAULT" -> List.of("DOCUMENTS", "DOCUMENT_VAULT");
            case "FINANCE", "FINANCIAL_RECORDS" -> List.of("FINANCE", "FINANCIAL_RECORDS");
            case "COMPLIANCE", "COMPLIANCE_CENTER" -> List.of("COMPLIANCE", "COMPLIANCE_CENTER");
            case "TASKS", "COMPANY_TASKS" -> List.of("TASKS", "COMPANY_TASKS");
            case "PRODUCTS", "PRODUCTS_PORTFOLIO" -> List.of("PRODUCTS", "PRODUCTS_PORTFOLIO");
            case "CONTACTS", "CONTACTS_PARTNERS" -> List.of("CONTACTS", "CONTACTS_PARTNERS");
            case "AUDIT_LOGS", "ACTIVITY" -> List.of("AUDIT_LOGS", "ACTIVITY");
            default -> List.of(normalize(module));
        };
    }

    private boolean inRange(Instant instant, ReportFilters filters) {
        if (instant == null) return true;
        return inRange(instant.atZone(ZoneOffset.UTC).toLocalDate(), filters);
    }

    private boolean inRange(LocalDate date, ReportFilters filters) {
        if (date == null || filters == null) return true;
        if (filters.from() != null && date.isBefore(filters.from())) return false;
        return filters.to() == null || !date.isAfter(filters.to());
    }

    private LocalDate createdDate(BaseEntity entity) { return entity.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate(); }
    private LocalDate complianceDate(ComplianceItem item) { return item.getDueDate() == null ? createdDate(item) : item.getDueDate(); }
    private LocalDate taskDate(CompanyTask task) { return task.getDueDate() == null ? createdDate(task) : task.getDueDate(); }
    private LocalDate contactDate(CompanyContact contact) { return contact.getNextFollowUpDate() == null ? createdDate(contact) : contact.getNextFollowUpDate(); }

    private LocalDate reportingDate(FinancialRecord record) {
        try {
            return YearMonth.parse(record.getReportingMonth()).atDay(1);
        } catch (DateTimeParseException | NullPointerException ex) {
            return createdDate(record);
        }
    }

    private boolean isTaskOverdue(CompanyTask task, LocalDate today) {
        String status = enumText(task.getStatus());
        return task.getDueDate() != null && task.getDueDate().isBefore(today) && !"DONE".equals(status) && !"ARCHIVED".equals(status);
    }

    private boolean isComplianceOverdue(ComplianceItem item, LocalDate today) {
        String status = enumText(item.getStatus());
        return item.getDueDate() != null && item.getDueDate().isBefore(today) && !List.of("COMPLETED", "APPROVED", "NOT_APPLICABLE", "ARCHIVED").contains(status);
    }

    private boolean isFollowUpDue(CompanyContact contact, LocalDate today) {
        String status = enumText(contact.getStatus());
        return contact.getNextFollowUpDate() != null && !contact.getNextFollowUpDate().isAfter(today) && !List.of("CLOSED", "ARCHIVED").contains(status);
    }

    private boolean activityModuleMatches(String module, ReportFilters filters) {
        if (filters == null || blank(filters.module())) return true;
        String requested = normalize(filters.module());
        if ("AUDIT_LOGS".equals(requested) || "ACTIVITY".equals(requested)) return true;
        return moduleMatches(module, filters);
    }

    private boolean canViewAuditLog(AppUser actor, AuditLog log) {
        if (actor.hasRole(Role.FOUNDER)) return true;
        if (!actor.hasRole(Role.DIRECTOR)) return false;
        return RESTRICTED_AUDIT_MODULES.stream().noneMatch(module -> module.equalsIgnoreCase(log.getModule()));
    }

    private String countOpenTasks(List<CompanyTask> rows) {
        long count = rows.stream().filter(task -> !List.of("DONE", "ARCHIVED").contains(enumText(task.getStatus()))).count();
        return String.valueOf(count);
    }

    private String countOpenCompliance(List<ComplianceItem> rows) {
        long count = rows.stream().filter(item -> !List.of("COMPLETED", "APPROVED", "NOT_APPLICABLE", "ARCHIVED").contains(enumText(item.getStatus()))).count();
        return String.valueOf(count);
    }

    private BigDecimal sum(List<FinancialRecord> rows, Function<FinancialRecord, BigDecimal> mapper) {
        return rows.stream().map(mapper).filter(value -> value != null).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private Map<String, String> summaryRow(String module, int count, String lastUpdated) {
        return row("Module", module, "Records", String.valueOf(count), "Last Updated", lastUpdated);
    }

    private String lastUpdated(List<? extends BaseEntity> rows) {
        return rows.stream().map(BaseEntity::getUpdatedAt).max(Comparator.naturalOrder()).map(this::instant).orElse("No information has been added yet.");
    }

    private ReportMetric metric(String label, long value, String tone) { return metric(label, String.valueOf(value), tone); }
    private ReportMetric metric(String label, int value, String tone) { return metric(label, String.valueOf(value), tone); }
    private ReportMetric metric(String label, String value, String tone) { return new ReportMetric(label, value, tone); }
    private ReportSection section(String title, List<String> columns, List<Map<String, String>> rows) { return new ReportSection(title, columns, rows); }

    private Map<String, String> row(String... values) {
        Map<String, String> row = new LinkedHashMap<>();
        for (int index = 0; index + 1 < values.length; index += 2) row.put(values[index], text(values[index + 1]));
        return row;
    }

    private String enumText(Object value) { return value == null ? "" : value.toString(); }
    private String text(String value) { return blank(value) ? "No information has been added yet." : value; }
    private String money(BigDecimal value) { return "INR " + (value == null ? "0.00" : value.toPlainString()); }
    private String date(LocalDate value) { return value == null ? "No information has been added yet." : DateTimeFormatter.ISO_LOCAL_DATE.format(value); }
    private String instant(Instant value) { return value == null ? "No information has been added yet." : DateTimeFormatter.ISO_INSTANT.format(value); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private String normalize(String value) { return value == null ? "" : value.trim().replace('-', '_').replace(' ', '_').toUpperCase(Locale.ROOT); }
}

