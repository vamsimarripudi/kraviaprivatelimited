package com.kravia.companyos.platform;

import com.kravia.companyos.common.Role;
import com.kravia.companyos.company.CompanyProfile;
import com.kravia.companyos.company.CompanyProfileRepository;
import com.kravia.companyos.compliance.ComplianceItem;
import com.kravia.companyos.compliance.ComplianceItemRepository;
import com.kravia.companyos.compliance.ComplianceStatus;
import com.kravia.companyos.contact.CompanyContact;
import com.kravia.companyos.contact.ContactRepository;
import com.kravia.companyos.contact.ContactStatus;
import com.kravia.companyos.document.DocumentRecord;
import com.kravia.companyos.document.DocumentRepository;
import com.kravia.companyos.finance.FinancialRecord;
import com.kravia.companyos.finance.FinancialRecordRepository;
import com.kravia.companyos.meeting.BoardMeeting;
import com.kravia.companyos.meeting.BoardMeetingRepository;
import com.kravia.companyos.meeting.MeetingStatus;
import com.kravia.companyos.notification.Notification;
import com.kravia.companyos.notification.NotificationRepository;
import com.kravia.companyos.product.CompanyProduct;
import com.kravia.companyos.product.ProductRepository;
import com.kravia.companyos.product.ProductStatus;
import com.kravia.companyos.sales.LeadStage;
import com.kravia.companyos.sales.SalesCustomerRepository;
import com.kravia.companyos.sales.SalesLead;
import com.kravia.companyos.sales.SalesLeadRepository;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.task.CompanyTask;
import com.kravia.companyos.task.CompanyTaskRepository;
import com.kravia.companyos.task.TaskStatus;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExecutiveDashboardService {
    private final CompanyProfileRepository companyProfiles;
    private final FinancialRecordRepository financialRecords;
    private final ComplianceItemRepository complianceItems;
    private final BoardMeetingRepository meetings;
    private final CompanyTaskRepository tasks;
    private final ProductRepository products;
    private final DocumentRepository documents;
    private final NotificationRepository notifications;
    private final ContactRepository contacts;
    private final WorkflowInstanceRepository workflows;
    private final SalesLeadRepository salesLeads;
    private final SalesCustomerRepository salesCustomers;
    private final PermissionService permissions;

    public ExecutiveDashboardService(
        CompanyProfileRepository companyProfiles,
        FinancialRecordRepository financialRecords,
        ComplianceItemRepository complianceItems,
        BoardMeetingRepository meetings,
        CompanyTaskRepository tasks,
        ProductRepository products,
        DocumentRepository documents,
        NotificationRepository notifications,
        ContactRepository contacts,
        WorkflowInstanceRepository workflows,
        SalesLeadRepository salesLeads,
        SalesCustomerRepository salesCustomers,
        PermissionService permissions
    ) {
        this.companyProfiles = companyProfiles;
        this.financialRecords = financialRecords;
        this.complianceItems = complianceItems;
        this.meetings = meetings;
        this.tasks = tasks;
        this.products = products;
        this.documents = documents;
        this.notifications = notifications;
        this.contacts = contacts;
        this.workflows = workflows;
        this.salesLeads = salesLeads;
        this.salesCustomers = salesCustomers;
        this.permissions = permissions;
    }

    @Transactional(readOnly = true)
    public ExecutiveDashboardResponse getDashboard(AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);

        List<ComplianceItem> compliance = complianceItems.findAll();
        List<CompanyTask> taskRecords = tasks.findAll();
        List<CompanyProduct> productRecords = products.findAll();
        List<CompanyContact> contactRecords = contacts.findAll();
        List<Notification> notificationRecords = visibleNotifications(actor);

        long pendingApprovalCount = workflows.countByStateAndArchivedAtIsNull(WorkflowState.PENDING_APPROVAL);
        long overdueComplianceCount = compliance.stream().filter(this::isOverdueCompliance).count();
        long openTaskCount = taskRecords.stream().filter(this::isOpenTask).count();
        long blockedTaskCount = taskRecords.stream().filter(task -> task.getStatus() == TaskStatus.BLOCKED).count();
        long unreadNotificationCount = notificationRecords.stream().filter(notification -> notification.getReadAt() == null && notification.getArchivedAt() == null).count();
        long waitingPartnerCount = contactRecords.stream().filter(contact -> contact.getStatus() == ContactStatus.WAITING).count();
        List<SalesLead> leadRecords = salesLeads.findAll();
        long totalLeads = leadRecords.stream().filter(lead -> lead.getArchivedAt() == null && lead.getStage() != LeadStage.ARCHIVED).count();
        long activeOpportunities = leadRecords.stream().filter(this::isActiveOpportunity).count();
        long demoScheduled = leadRecords.stream().filter(lead -> lead.getArchivedAt() == null && lead.getStage() == LeadStage.DEMO_SCHEDULED).count();
        long proposalsSent = leadRecords.stream().filter(lead -> lead.getArchivedAt() == null && lead.getStage() == LeadStage.PROPOSAL_SENT).count();
        long wonCustomers = salesCustomers.findAll().stream().filter(customer -> customer.getArchivedAt() == null).count();
        long lostLeads = leadRecords.stream().filter(lead -> lead.getArchivedAt() == null && lead.getStage() == LeadStage.LOST).count();
        long followUpsDue = leadRecords.stream().filter(this::isFollowUpDue).count();

        List<ExecutiveDashboardResponse.DashboardMetric> metrics = List.of(
            new ExecutiveDashboardResponse.DashboardMetric("Pending approvals", pendingApprovalCount),
            new ExecutiveDashboardResponse.DashboardMetric("Compliance alerts", overdueComplianceCount),
            new ExecutiveDashboardResponse.DashboardMetric("Open tasks", openTaskCount),
            new ExecutiveDashboardResponse.DashboardMetric("Blocked tasks", blockedTaskCount),
            new ExecutiveDashboardResponse.DashboardMetric("Unread notifications", unreadNotificationCount),
            new ExecutiveDashboardResponse.DashboardMetric("Waiting partner responses", waitingPartnerCount),
            new ExecutiveDashboardResponse.DashboardMetric("Total leads", totalLeads),
            new ExecutiveDashboardResponse.DashboardMetric("Active opportunities", activeOpportunities),
            new ExecutiveDashboardResponse.DashboardMetric("Demo scheduled", demoScheduled),
            new ExecutiveDashboardResponse.DashboardMetric("Proposals sent", proposalsSent),
            new ExecutiveDashboardResponse.DashboardMetric("Won customers", wonCustomers),
            new ExecutiveDashboardResponse.DashboardMetric("Lost leads", lostLeads),
            new ExecutiveDashboardResponse.DashboardMetric("Follow-ups due", followUpsDue)
        );

        return new ExecutiveDashboardResponse(
            companyOverview(),
            financialHighlights(),
            metrics,
            pendingApprovalItems(),
            complianceAlerts(compliance),
            upcomingMeetings(),
            openTasks(taskRecords),
            productProgress(productRecords),
            recentDocuments(),
            recentNotifications(notificationRecords),
            insights(openTaskCount, overdueComplianceCount, pendingApprovalCount, unreadNotificationCount)
        );
    }

    private ExecutiveDashboardResponse.CompanyOverview companyOverview() {
        return companyProfiles.findAll().stream()
            .findFirst()
            .map(profile -> new ExecutiveDashboardResponse.CompanyOverview(
                emptyToNull(profile.getCompanyName()),
                emptyToNull(profile.getCompanyStatus()),
                profile.getUpdatedAt()
            ))
            .orElse(new ExecutiveDashboardResponse.CompanyOverview(null, null, null));
    }

    private ExecutiveDashboardResponse.FinancialHighlights financialHighlights() {
        return financialRecords.findAll().stream()
            .filter(record -> record.getArchivedAt() == null)
            .max(Comparator.comparing(FinancialRecord::getReportingMonth))
            .map(record -> new ExecutiveDashboardResponse.FinancialHighlights(
                true,
                record.getReportingMonth(),
                money(record.getRevenue()),
                money(record.getExpenses()),
                money(record.getProfitOrLoss()),
                money(record.getCashBalance()),
                money(record.getNetGstPosition())
            ))
            .orElse(new ExecutiveDashboardResponse.FinancialHighlights(false, null, null, null, null, null, null));
    }

    private List<ExecutiveDashboardResponse.DashboardItem> pendingApprovalItems() {
        return workflows.search(null, null, WorkflowState.PENDING_APPROVAL, null).stream()
            .limit(5)
            .map(workflow -> item(workflow.getId(), "WORKFLOW", workflow.getTitle(), workflow.getState().name(), workflow.getUpdatedAt().toString()))
            .toList();
    }

    private List<ExecutiveDashboardResponse.DashboardItem> complianceAlerts(List<ComplianceItem> compliance) {
        LocalDate today = LocalDate.now();
        return compliance.stream()
            .filter(item -> item.getArchivedAt() == null)
            .filter(item -> item.getDueDate() != null)
            .filter(item -> item.getDueDate().isBefore(today) || !item.getDueDate().isAfter(today.plusDays(14)))
            .sorted(Comparator.comparing(ComplianceItem::getDueDate))
            .limit(5)
            .map(item -> item(item.getId(), "COMPLIANCE", item.getTitle(), item.getStatus().name(), item.getDueDate().toString()))
            .toList();
    }

    private List<ExecutiveDashboardResponse.DashboardItem> upcomingMeetings() {
        return meetings.findAll().stream()
            .filter(meeting -> meeting.getArchivedAt() == null)
            .filter(meeting -> meeting.getStatus() == MeetingStatus.SCHEDULED || meeting.getStatus() == MeetingStatus.DRAFT)
            .filter(meeting -> meeting.getMeetingDate() != null)
            .sorted(Comparator.comparing(BoardMeeting::getMeetingDate))
            .limit(5)
            .map(meeting -> item(meeting.getId(), "BOARD_MEETINGS", meeting.getTitle(), meeting.getStatus().name(), meeting.getMeetingDate().toLocalDate().toString()))
            .toList();
    }

    private List<ExecutiveDashboardResponse.DashboardItem> openTasks(List<CompanyTask> taskRecords) {
        return taskRecords.stream()
            .filter(this::isOpenTask)
            .sorted(Comparator.comparing(CompanyTask::getDueDate, Comparator.nullsLast(Comparator.naturalOrder())))
            .limit(5)
            .map(task -> item(task.getId(), "TASKS", task.getTitle(), task.getStatus().name(), task.getDueDate() == null ? null : task.getDueDate().toString()))
            .toList();
    }

    private ExecutiveDashboardResponse.ProductProgress productProgress(List<CompanyProduct> productRecords) {
        List<CompanyProduct> active = productRecords.stream().filter(product -> product.getArchivedAt() == null && product.getStatus() != ProductStatus.ARCHIVED).toList();
        long launchReady = active.stream().filter(product -> product.getStatus() == ProductStatus.LAUNCH_READY).count();
        long withRisks = active.stream().filter(product -> product.getRisks() != null && !product.getRisks().isBlank()).count();
        int averageReadiness = active.isEmpty()
            ? 0
            : (int) Math.round(active.stream().map(CompanyProduct::getLaunchReadinessPercentage).filter(Objects::nonNull).mapToInt(Integer::intValue).average().orElse(0));
        return new ExecutiveDashboardResponse.ProductProgress(active.size(), active.size(), launchReady, withRisks, averageReadiness);
    }

    private List<ExecutiveDashboardResponse.DashboardItem> recentDocuments() {
        return documents.findAll().stream()
            .filter(document -> document.getArchivedAt() == null)
            .sorted(Comparator.comparing(DocumentRecord::getUpdatedAt).reversed())
            .limit(5)
            .map(document -> item(document.getId(), "DOCUMENTS", document.getTitle(), document.getStatus().name(), document.getUpdatedAt().toString()))
            .toList();
    }

    private List<ExecutiveDashboardResponse.DashboardItem> recentNotifications(List<Notification> records) {
        return records.stream()
            .filter(notification -> notification.getArchivedAt() == null)
            .sorted(Comparator.comparing(Notification::getUpdatedAt).reversed())
            .limit(5)
            .map(notification -> item(notification.getId(), "NOTIFICATIONS", notification.getTitle(), notification.getReadAt() == null ? "UNREAD" : "READ", notification.getUpdatedAt().toString()))
            .toList();
    }

    private List<Notification> visibleNotifications(AppUser actor) {
        List<Notification> records = notifications.findAll();
        if (actor.hasRole(Role.FOUNDER)) return records;
        return records.stream().filter(notification -> notification.getRecipientEmail().equalsIgnoreCase(actor.getEmail())).toList();
    }

    private List<String> insights(long openTasks, long overdueCompliance, long pendingApprovals, long unreadNotifications) {
        List<String> generated = List.of(
            openTasks > 0 ? openTasks + " open task(s) require owner review." : null,
            overdueCompliance > 0 ? overdueCompliance + " compliance item(s) are overdue or due soon." : null,
            pendingApprovals > 0 ? pendingApprovals + " workflow approval(s) are pending." : null,
            unreadNotifications > 0 ? unreadNotifications + " unread notification(s) need attention." : null
        ).stream().filter(Objects::nonNull).toList();
        return generated.isEmpty() ? List.of("No information available.") : generated;
    }

    private boolean isOpenTask(CompanyTask task) {
        return task.getArchivedAt() == null && task.getStatus() != TaskStatus.DONE && task.getStatus() != TaskStatus.ARCHIVED;
    }

    private boolean isActiveOpportunity(SalesLead lead) {
        return lead.getArchivedAt() == null
            && lead.getStage() != LeadStage.WON
            && lead.getStage() != LeadStage.LOST
            && lead.getStage() != LeadStage.ARCHIVED;
    }

    private boolean isFollowUpDue(SalesLead lead) {
        return isActiveOpportunity(lead)
            && lead.getNextFollowUpDate() != null
            && !lead.getNextFollowUpDate().isAfter(LocalDate.now());
    }

    private boolean isOverdueCompliance(ComplianceItem item) {
        return item.getArchivedAt() == null
            && item.getDueDate() != null
            && item.getDueDate().isBefore(LocalDate.now())
            && item.getStatus() != ComplianceStatus.COMPLETED
            && item.getStatus() != ComplianceStatus.APPROVED
            && item.getStatus() != ComplianceStatus.NOT_APPLICABLE
            && item.getStatus() != ComplianceStatus.ARCHIVED;
    }

    private ExecutiveDashboardResponse.DashboardItem item(java.util.UUID id, String module, String title, String status, String dateLabel) {
        return new ExecutiveDashboardResponse.DashboardItem(id, module, title, status, dateLabel);
    }

    private BigDecimal money(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private String emptyToNull(String value) { return value == null || value.isBlank() ? null : value; }
}
