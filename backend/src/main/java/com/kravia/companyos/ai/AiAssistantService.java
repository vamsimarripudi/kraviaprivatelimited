package com.kravia.companyos.ai;

import com.kravia.companyos.announcement.Announcement;
import com.kravia.companyos.announcement.AnnouncementRepository;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
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
import com.kravia.companyos.meeting.MeetingActionItem;
import com.kravia.companyos.meeting.MeetingDecision;
import com.kravia.companyos.meeting.MeetingResolution;
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
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AiAssistantService {
    private static final String MODULE = "AI_ASSISTANT";
    private static final String EMPTY_RESPONSE = "No information available.";

    private final AiQueryRepository aiQueries;
    private final CompanyProfileRepository companyProfiles;
    private final DocumentRepository documents;
    private final BoardMeetingRepository meetings;
    private final FinancialRecordRepository financialRecords;
    private final ComplianceItemRepository complianceItems;
    private final CompanyTaskRepository tasks;
    private final ProductRepository products;
    private final ContactRepository contacts;
    private final AnnouncementRepository announcements;
    private final PermissionService permissions;
    private final AuditService auditService;

    public AiAssistantService(
        AiQueryRepository aiQueries,
        CompanyProfileRepository companyProfiles,
        DocumentRepository documents,
        BoardMeetingRepository meetings,
        FinancialRecordRepository financialRecords,
        ComplianceItemRepository complianceItems,
        CompanyTaskRepository tasks,
        ProductRepository products,
        ContactRepository contacts,
        AnnouncementRepository announcements,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.aiQueries = aiQueries;
        this.companyProfiles = companyProfiles;
        this.documents = documents;
        this.meetings = meetings;
        this.financialRecords = financialRecords;
        this.complianceItems = complianceItems;
        this.tasks = tasks;
        this.products = products;
        this.contacts = contacts;
        this.announcements = announcements;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional
    public AiQueryResponse query(AiQueryRequest request, AppUser actor) {
        requireAiAccess(actor);
        validate(request);
        AiModuleContext moduleContext = request.moduleContext() == null ? AiModuleContext.ALL : request.moduleContext();
        AiDateRange dateRange = request.dateRange() == null ? new AiDateRange(null, null) : request.dateRange();
        List<ContextSnapshotDraft> snapshots = buildSnapshots(moduleContext, dateRange);
        String response = generateResponse(request.query().trim(), moduleContext, request.outputType(), snapshots);

        AiQuery entity = new AiQuery();
        entity.setQuery(request.query().trim());
        entity.setModuleContext(moduleContext);
        entity.setOutputType(request.outputType());
        entity.setDateFrom(dateRange.from());
        entity.setDateTo(dateRange.to());
        entity.setCreatedBy(actor.getDisplayName());
        entity.setActorEmail(actor.getEmail());
        entity.setResponse(response);
        for (ContextSnapshotDraft snapshotDraft : snapshots) {
            AiContextSnapshot snapshot = new AiContextSnapshot();
            snapshot.setAiQuery(entity);
            snapshot.setModuleContext(snapshotDraft.moduleContext());
            snapshot.setSnapshotText(snapshotDraft.snapshotText());
            entity.getContextSnapshots().add(snapshot);
        }
        AiQuery saved = aiQueries.saveAndFlush(entity);
        auditService.record(actor, MODULE, "AI_QUERY_CREATED", "Submitted AI query for " + moduleContext + " as " + request.outputType(), "IMPORTANT");
        return AiQueryResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<AiQueryResponse> history(AppUser actor) {
        requireAiAccess(actor);
        List<AiQuery> records = actor.hasRole(Role.FOUNDER)
            ? aiQueries.findByArchivedAtIsNullOrderByCreatedAtDesc()
            : aiQueries.findByActorEmailIgnoreCaseAndArchivedAtIsNullOrderByCreatedAtDesc(actor.getEmail());
        return records.stream().map(AiQueryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public AiQueryResponse historyItem(UUID id, AppUser actor) {
        return AiQueryResponse.from(findVisible(id, actor));
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        AiQuery query = findVisible(id, actor);
        if (query.getArchivedAt() == null) query.setArchivedAt(Instant.now());
        aiQueries.saveAndFlush(query);
        auditService.record(actor, MODULE, "AI_QUERY_ARCHIVED", "Archived AI query " + query.getId(), "INFO");
    }

    private AiQuery findVisible(UUID id, AppUser actor) {
        requireAiAccess(actor);
        AiQuery query = aiQueries.findById(id).orElseThrow(() -> new NotFoundException("AI query not found."));
        if (query.getArchivedAt() != null) throw new NotFoundException("AI query not found.");
        if (!actor.hasRole(Role.FOUNDER) && !query.getActorEmail().equalsIgnoreCase(actor.getEmail())) throw new NotFoundException("AI query not found.");
        return query;
    }

    private void requireAiAccess(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }

    private void validate(AiQueryRequest request) {
        if (request.query() == null || request.query().isBlank()) throw new IllegalArgumentException("AI query is required.");
        if (request.outputType() == null) throw new IllegalArgumentException("AI output type is required.");
        AiDateRange range = request.dateRange();
        if (range != null && range.from() != null && range.to() != null && range.from().isAfter(range.to())) throw new IllegalArgumentException("AI query start date cannot be after end date.");
    }

    private List<ContextSnapshotDraft> buildSnapshots(AiModuleContext moduleContext, AiDateRange dateRange) {
        List<ContextSnapshotDraft> snapshots = new ArrayList<>();
        addIfPresent(snapshots, AiModuleContext.COMPANY_PROFILE, moduleContext, companyProfileSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.DOCUMENTS, moduleContext, documentSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.BOARD_MEETINGS, moduleContext, meetingSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.FINANCE, moduleContext, financeSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.COMPLIANCE, moduleContext, complianceSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.TASKS, moduleContext, taskSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.PRODUCTS, moduleContext, productSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.CONTACTS, moduleContext, contactSnapshot(dateRange));
        addIfPresent(snapshots, AiModuleContext.ANNOUNCEMENTS, moduleContext, announcementSnapshot(dateRange));
        return snapshots;
    }

    private void addIfPresent(List<ContextSnapshotDraft> snapshots, AiModuleContext candidate, AiModuleContext requested, String snapshotText) {
        if (requested != AiModuleContext.ALL && requested != candidate) return;
        if (snapshotText == null || snapshotText.isBlank()) return;
        snapshots.add(new ContextSnapshotDraft(candidate.name(), snapshotText));
    }

    private String companyProfileSnapshot(AiDateRange dateRange) {
        List<CompanyProfile> rows = companyProfiles.findAll().stream()
            .filter(profile -> inRange(createdDate(profile.getCreatedAt()), dateRange))
            .sorted(Comparator.comparing(CompanyProfile::getUpdatedAt).reversed())
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Company Profile");
        for (CompanyProfile profile : rows) {
            appendLine(builder, "Company", profile.getCompanyName());
            appendLine(builder, "CIN", profile.getCin());
            appendLine(builder, "PAN", profile.getPan());
            appendLine(builder, "TAN", profile.getTan());
            appendLine(builder, "Status", profile.getCompanyStatus());
            appendLine(builder, "Registered office", profile.getRegisteredOfficeAddress());
            appendLine(builder, "Directors", profile.getDirectors());
            appendLine(builder, "Shareholders", profile.getShareholders());
            appendLine(builder, "Last updated", profile.getLastUpdatedDate());
        }
        return builder.toString();
    }

    private String documentSnapshot(AiDateRange dateRange) {
        List<DocumentRecord> rows = documents.findAll().stream()
            .filter(document -> inRange(createdDate(document.getCreatedAt()), dateRange))
            .sorted(Comparator.comparing(DocumentRecord::getUpdatedAt).reversed())
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Document Vault Metadata");
        builder.append("Document file contents are not included. Metadata only.\n");
        for (DocumentRecord document : rows) {
            builder.append("- ").append(text(document.getTitle())).append(" | category: ").append(document.getCategory()).append(" | status: ").append(document.getStatus()).append(" | version: ").append(document.getVersion()).append(" | uploaded by: ").append(text(document.getUploadedBy())).append("\n");
        }
        return builder.toString();
    }

    private String meetingSnapshot(AiDateRange dateRange) {
        List<BoardMeeting> rows = meetings.findAll().stream()
            .filter(meeting -> inRange(meeting.getMeetingDate().toLocalDate(), dateRange))
            .sorted(Comparator.comparing(BoardMeeting::getMeetingDate).reversed())
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Board Meetings");
        for (BoardMeeting meeting : rows) {
            builder.append("- ").append(meeting.getTitle()).append(" | date: ").append(meeting.getMeetingDate()).append(" | type: ").append(meeting.getMeetingType()).append(" | status: ").append(meeting.getStatus()).append("\n");
            appendNested(builder, "Agenda", meeting.getAgendaItems().stream().map(item -> item.getItemText()).toList());
            appendLine(builder, "Discussion", meeting.getDiscussionNotes());
            appendNested(builder, "Decisions", meeting.getDecisions().stream().map(MeetingDecision::getDecisionText).toList());
            appendNested(builder, "Resolutions", meeting.getResolutions().stream().map(MeetingResolution::getResolutionText).toList());
            appendNested(builder, "Action items", meeting.getActionItems().stream().map(this::meetingActionText).toList());
        }
        return builder.toString();
    }

    private String financeSnapshot(AiDateRange dateRange) {
        List<FinancialRecord> rows = financialRecords.findAll().stream()
            .filter(record -> inRange(reportingDate(record), dateRange))
            .sorted(Comparator.comparing(FinancialRecord::getReportingMonth, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
        if (rows.isEmpty()) return "";
        BigDecimal revenue = sum(rows.stream().map(FinancialRecord::getRevenue).toList());
        BigDecimal expenses = sum(rows.stream().map(FinancialRecord::getExpenses).toList());
        BigDecimal profit = sum(rows.stream().map(FinancialRecord::getProfitOrLoss).toList());
        BigDecimal netGst = sum(rows.stream().map(FinancialRecord::getNetGstPosition).toList());
        StringBuilder builder = header("Financial Records");
        builder.append("Totals | revenue: ").append(money(revenue)).append(" | expenses: ").append(money(expenses)).append(" | profit/loss: ").append(money(profit)).append(" | net GST: ").append(money(netGst)).append("\n");
        for (FinancialRecord record : rows) {
            builder.append("- ").append(record.getReportingMonth()).append(" | revenue: ").append(money(record.getRevenue())).append(" | expenses: ").append(money(record.getExpenses())).append(" | profit/loss: ").append(money(record.getProfitOrLoss())).append(" | cash: ").append(money(record.getCashBalance())).append(" | receivables: ").append(money(record.getReceivables())).append(" | payables: ").append(money(record.getPayables())).append(" | GST collected: ").append(money(record.getGstCollected())).append(" | GST paid: ").append(money(record.getGstPaid())).append(" | net GST: ").append(money(record.getNetGstPosition())).append(" | status: ").append(record.getStatus()).append("\n");
            appendLine(builder, "Founder notes", record.getFounderNotes());
        }
        return builder.toString();
    }

    private String complianceSnapshot(AiDateRange dateRange) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<ComplianceItem> rows = complianceItems.findAll().stream()
            .filter(item -> inRange(item.getDueDate() == null ? createdDate(item.getCreatedAt()) : item.getDueDate(), dateRange))
            .sorted(Comparator.comparing(item -> item.getDueDate() == null ? LocalDate.MAX : item.getDueDate()))
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Compliance Items");
        for (ComplianceItem item : rows) {
            builder.append("- ").append(item.getTitle()).append(" | category: ").append(item.getCategory()).append(" | status: ").append(item.getStatus()).append(" | priority: ").append(item.getPriority()).append(" | due: ").append(value(item.getDueDate())).append(" | responsible: ").append(text(item.getResponsiblePerson())).append(" | overdue: ").append(isComplianceOverdue(item, today)).append("\n");
            appendLine(builder, "Notes", item.getNotes());
        }
        return builder.toString();
    }

    private String taskSnapshot(AiDateRange dateRange) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<CompanyTask> rows = tasks.findAll().stream()
            .filter(task -> inRange(task.getDueDate() == null ? createdDate(task.getCreatedAt()) : task.getDueDate(), dateRange))
            .sorted(Comparator.comparing(task -> task.getDueDate() == null ? LocalDate.MAX : task.getDueDate()))
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Company Tasks");
        for (CompanyTask task : rows) {
            builder.append("- ").append(task.getTitle()).append(" | category: ").append(task.getCategory()).append(" | status: ").append(task.getStatus()).append(" | priority: ").append(task.getPriority()).append(" | assigned to: ").append(text(task.getAssignedTo())).append(" | due: ").append(value(task.getDueDate())).append(" | overdue: ").append(isTaskOverdue(task, today)).append("\n");
            appendLine(builder, "Notes", task.getNotes());
        }
        return builder.toString();
    }

    private String productSnapshot(AiDateRange dateRange) {
        List<CompanyProduct> rows = products.findAll().stream()
            .filter(product -> inRange(createdDate(product.getCreatedAt()), dateRange))
            .sorted(Comparator.comparing(CompanyProduct::getUpdatedAt).reversed())
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Products Portfolio");
        for (CompanyProduct product : rows) {
            builder.append("- ").append(product.getName()).append(" | category: ").append(product.getCategory()).append(" | status: ").append(product.getStatus()).append(" | stage: ").append(text(product.getDevelopmentStage())).append(" | readiness: ").append(product.getLaunchReadinessPercentage()).append("% | owner: ").append(text(product.getResponsiblePerson())).append("\n");
            appendLine(builder, "Milestone", product.getNextMilestone());
            appendLine(builder, "Risks", product.getRisks());
            appendLine(builder, "Pending work", product.getPendingWork());
        }
        return builder.toString();
    }

    private String contactSnapshot(AiDateRange dateRange) {
        List<CompanyContact> rows = contacts.findAll().stream()
            .filter(contact -> inRange(contact.getNextFollowUpDate() == null ? createdDate(contact.getCreatedAt()) : contact.getNextFollowUpDate(), dateRange))
            .sorted(Comparator.comparing(contact -> contact.getNextFollowUpDate() == null ? LocalDate.MAX : contact.getNextFollowUpDate()))
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Contacts & Partners");
        for (CompanyContact contact : rows) {
            builder.append("- ").append(contact.getName()).append(" | organization: ").append(text(contact.getOrganization())).append(" | role: ").append(text(contact.getRole())).append(" | category: ").append(contact.getCategory()).append(" | status: ").append(contact.getStatus()).append(" | next follow-up: ").append(value(contact.getNextFollowUpDate())).append("\n");
        }
        return builder.toString();
    }

    private String announcementSnapshot(AiDateRange dateRange) {
        List<Announcement> rows = announcements.findAll().stream()
            .filter(announcement -> inRange(createdDate(announcement.getCreatedAt()), dateRange))
            .sorted(Comparator.comparing(Announcement::getUpdatedAt).reversed())
            .toList();
        if (rows.isEmpty()) return "";
        StringBuilder builder = header("Announcements");
        for (Announcement announcement : rows) {
            builder.append("- ").append(announcement.getTitle()).append(" | audience: ").append(announcement.getAudience()).append(" | status: ").append(announcement.getStatus()).append(" | updated: ").append(announcement.getUpdatedAt()).append("\n");
            appendLine(builder, "Message", announcement.getMessage());
        }
        return builder.toString();
    }

    private String generateResponse(String query, AiModuleContext moduleContext, AiOutputType outputType, List<ContextSnapshotDraft> snapshots) {
        if (snapshots.isEmpty()) return EMPTY_RESPONSE;
        return switch (outputType) {
            case BOARD_RESOLUTION -> boardResolutionDraft(snapshots);
            case EMAIL_DRAFT -> emailDraft(query, moduleContext, snapshots);
            case RISK_ANALYSIS -> riskAnalysis(snapshots);
            case ACTION_ITEMS -> actionItems(snapshots);
            case SUMMARY -> summary(moduleContext, snapshots);
            case GENERAL_ANSWER -> generalAnswer(query, moduleContext, snapshots);
        };
    }

    private String summary(AiModuleContext moduleContext, List<ContextSnapshotDraft> snapshots) {
        StringBuilder builder = new StringBuilder("Summary for ").append(moduleContext).append("\n\n");
        snapshots.forEach(snapshot -> builder.append(snapshot.snapshotText()).append("\n"));
        return limit(builder.toString());
    }

    private String generalAnswer(String query, AiModuleContext moduleContext, List<ContextSnapshotDraft> snapshots) {
        String normalized = query.toLowerCase(Locale.ROOT);
        if (normalized.contains("profit") || normalized.contains("loss") || normalized.contains("gst")) return financeFocusedAnswer(snapshots);
        if (normalized.contains("overdue") || normalized.contains("pending action") || normalized.contains("action item")) return actionItems(snapshots);
        if (normalized.contains("compliance") || normalized.contains("due")) return complianceFocusedAnswer(snapshots);
        if (normalized.contains("product") || normalized.contains("progress")) return productFocusedAnswer(snapshots);
        return summary(moduleContext, snapshots);
    }

    private String financeFocusedAnswer(List<ContextSnapshotDraft> snapshots) {
        return snapshots.stream()
            .filter(snapshot -> snapshot.moduleContext().equals(AiModuleContext.FINANCE.name()))
            .findFirst()
            .map(snapshot -> "Financial explanation based on stored records only:\n\n" + snapshot.snapshotText())
            .orElse(EMPTY_RESPONSE);
    }

    private String complianceFocusedAnswer(List<ContextSnapshotDraft> snapshots) {
        return snapshots.stream()
            .filter(snapshot -> snapshot.moduleContext().equals(AiModuleContext.COMPLIANCE.name()))
            .findFirst()
            .map(snapshot -> "Compliance status based on stored records only:\n\n" + snapshot.snapshotText())
            .orElse(EMPTY_RESPONSE);
    }

    private String productFocusedAnswer(List<ContextSnapshotDraft> snapshots) {
        return snapshots.stream()
            .filter(snapshot -> snapshot.moduleContext().equals(AiModuleContext.PRODUCTS.name()))
            .findFirst()
            .map(snapshot -> "Product progress based on stored records only:\n\n" + snapshot.snapshotText())
            .orElse(EMPTY_RESPONSE);
    }

    private String boardResolutionDraft(List<ContextSnapshotDraft> snapshots) {
        String meetingText = snapshots.stream()
            .filter(snapshot -> snapshot.moduleContext().equals(AiModuleContext.BOARD_MEETINGS.name()))
            .map(ContextSnapshotDraft::snapshotText)
            .findFirst()
            .orElse("");
        if (meetingText.isBlank() || !meetingText.contains("Resolutions:")) return EMPTY_RESPONSE;
        return limit("Draft Board Resolution\n\nBased only on stored board meeting resolution records:\n\nRESOLVED THAT the company records reflect the following resolution text:\n\n" + meetingText + "\nThis draft must be reviewed by the company secretary or legal advisor before use.");
    }

    private String emailDraft(String query, AiModuleContext moduleContext, List<ContextSnapshotDraft> snapshots) {
        String recipient = emailRecipient(query);
        StringBuilder builder = new StringBuilder();
        builder.append("Subject: KRAVIA PRIVATE LIMITED - Information for review\n\n");
        builder.append("Dear ").append(recipient).append(",\n\n");
        builder.append("Please review the following information from KRAVIA Company OS records.\n\n");
        snapshots.forEach(snapshot -> builder.append(snapshot.snapshotText()).append("\n"));
        builder.append("\nRegards,\nKRAVIA PRIVATE LIMITED");
        return limit(builder.toString());
    }

    private String riskAnalysis(List<ContextSnapshotDraft> snapshots) {
        List<String> riskLines = snapshots.stream()
            .flatMap(snapshot -> snapshot.snapshotText().lines())
            .filter(line -> containsAny(line, "overdue: true", "Risks:", "risk", "BLOCKED", "CRITICAL", "payables", "net GST"))
            .toList();
        if (riskLines.isEmpty()) return EMPTY_RESPONSE;
        return "Risk analysis based only on stored records:\n\n" + String.join("\n", riskLines);
    }

    private String actionItems(List<ContextSnapshotDraft> snapshots) {
        List<String> actionLines = snapshots.stream()
            .flatMap(snapshot -> snapshot.snapshotText().lines())
            .filter(line -> containsAny(line, "Action items:", "status: TODO", "status: IN_PROGRESS", "status: WAITING", "status: BLOCKED", "overdue: true", "Pending work", "due:"))
            .toList();
        if (actionLines.isEmpty()) return EMPTY_RESPONSE;
        return "Action items identified from stored records:\n\n" + String.join("\n", actionLines);
    }

    private boolean containsAny(String value, String... needles) {
        String normalized = value.toLowerCase(Locale.ROOT);
        for (String needle : needles) if (normalized.contains(needle.toLowerCase(Locale.ROOT))) return true;
        return false;
    }

    private String emailRecipient(String query) {
        String normalized = query.toLowerCase(Locale.ROOT);
        if (normalized.contains("ca") || normalized.contains("accountant")) return "CA Team";
        if (normalized.contains("bank")) return "Bank Team";
        if (normalized.contains("legal") || normalized.contains("lawyer")) return "Legal Team";
        if (normalized.contains("investor")) return "Investor Team";
        return "Team";
    }

    private void appendNested(StringBuilder builder, String label, List<String> values) {
        List<String> present = values.stream().filter(value -> value != null && !value.isBlank()).toList();
        if (present.isEmpty()) return;
        builder.append("  ").append(label).append(":\n");
        present.forEach(value -> builder.append("    - ").append(value).append("\n"));
    }

    private void appendLine(StringBuilder builder, String label, Object value) {
        String text = value(value);
        if (EMPTY_RESPONSE.equals(text)) return;
        builder.append("  ").append(label).append(": ").append(text).append("\n");
    }

    private String meetingActionText(MeetingActionItem item) {
        return item.getActionText() + " | owner: " + text(item.getOwner()) + " | due: " + value(item.getDueDate()) + " | status: " + item.getStatus();
    }

    private StringBuilder header(String title) { return new StringBuilder(title).append("\n"); }

    private boolean inRange(LocalDate date, AiDateRange range) {
        if (date == null || range == null) return true;
        if (range.from() != null && date.isBefore(range.from())) return false;
        return range.to() == null || !date.isAfter(range.to());
    }

    private LocalDate createdDate(Instant instant) { return instant.atZone(ZoneOffset.UTC).toLocalDate(); }

    private LocalDate reportingDate(FinancialRecord record) {
        try {
            return YearMonth.parse(record.getReportingMonth()).atDay(1);
        } catch (DateTimeParseException | NullPointerException ex) {
            return createdDate(record.getCreatedAt());
        }
    }

    private boolean isTaskOverdue(CompanyTask task, LocalDate today) {
        String status = task.getStatus() == null ? "" : task.getStatus().name();
        return task.getDueDate() != null && task.getDueDate().isBefore(today) && !List.of("DONE", "ARCHIVED").contains(status);
    }

    private boolean isComplianceOverdue(ComplianceItem item, LocalDate today) {
        String status = item.getStatus() == null ? "" : item.getStatus().name();
        return item.getDueDate() != null && item.getDueDate().isBefore(today) && !List.of("COMPLETED", "APPROVED", "NOT_APPLICABLE", "ARCHIVED").contains(status);
    }

    private BigDecimal sum(List<BigDecimal> values) {
        return values.stream().filter(value -> value != null).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String money(BigDecimal value) { return "INR " + (value == null ? "0.00" : value.toPlainString()); }
    private String text(String value) { return value == null || value.isBlank() ? EMPTY_RESPONSE : value; }
    private String value(Object value) { return value == null ? EMPTY_RESPONSE : value.toString(); }
    private String limit(String value) { return value.length() <= 12000 ? value : value.substring(0, 12000) + "\n[Response truncated to stored context limit.]"; }

    private record ContextSnapshotDraft(String moduleContext, String snapshotText) {}
}
