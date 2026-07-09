package com.kravia.companyos.analytics;

import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsDashboardResponse;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsDataset;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsExportRequest;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsExportResponse;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsMetric;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsModule;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsRiskIndicator;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsTrendPoint;
import com.kravia.companyos.asset.AssetEnums.AssetStatus;
import com.kravia.companyos.asset.CompanyAsset;
import com.kravia.companyos.asset.CompanyAssetRepository;
import com.kravia.companyos.asset.SoftwareLicense;
import com.kravia.companyos.asset.SoftwareLicenseRepository;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.compliance.ComplianceItem;
import com.kravia.companyos.compliance.ComplianceItemRepository;
import com.kravia.companyos.compliance.ComplianceStatus;
import com.kravia.companyos.finance.FinancialRecord;
import com.kravia.companyos.finance.FinancialRecordRepository;
import com.kravia.companyos.hr.AttendanceRecord;
import com.kravia.companyos.hr.AttendanceRecordRepository;
import com.kravia.companyos.hr.DepartmentRepository;
import com.kravia.companyos.hr.Employee;
import com.kravia.companyos.hr.EmployeeRepository;
import com.kravia.companyos.hr.ExitRecord;
import com.kravia.companyos.hr.ExitRecordRepository;
import com.kravia.companyos.hr.HrEnums.EmploymentStatus;
import com.kravia.companyos.hr.HrEnums.ExitStatus;
import com.kravia.companyos.hr.HrEnums.LeaveStatus;
import com.kravia.companyos.hr.LeaveRequest;
import com.kravia.companyos.hr.LeaveRequestRepository;
import com.kravia.companyos.hr.PayrollSummaryRepository;
import com.kravia.companyos.legal.LegalContract;
import com.kravia.companyos.legal.LegalContractRepository;
import com.kravia.companyos.legal.LegalEnums.LegalRiskSeverity;
import com.kravia.companyos.legal.LegalEnums.LegalStatus;
import com.kravia.companyos.legal.LegalEnums.SignatureStatus;
import com.kravia.companyos.legal.LegalRiskLink;
import com.kravia.companyos.legal.LegalRiskLinkRepository;
import com.kravia.companyos.procurement.ProcurementEnums.ProcurementStatus;
import com.kravia.companyos.procurement.ProcurementSubscription;
import com.kravia.companyos.procurement.ProcurementSubscriptionRepository;
import com.kravia.companyos.procurement.ProcurementVendor;
import com.kravia.companyos.procurement.ProcurementVendorRepository;
import com.kravia.companyos.procurement.VendorBill;
import com.kravia.companyos.procurement.VendorBillRepository;
import com.kravia.companyos.product.CompanyProduct;
import com.kravia.companyos.product.ProductRepository;
import com.kravia.companyos.product.ProductStatus;
import com.kravia.companyos.sales.LeadStage;
import com.kravia.companyos.sales.SalesCustomer;
import com.kravia.companyos.sales.SalesCustomerRepository;
import com.kravia.companyos.sales.SalesLead;
import com.kravia.companyos.sales.SalesLeadRepository;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.task.CompanyTask;
import com.kravia.companyos.task.CompanyTaskRepository;
import com.kravia.companyos.task.TaskStatus;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnalyticsService {
    private static final String UNIT_COUNT = "count";
    private static final String UNIT_INR = "INR";
    private static final String UNIT_PERCENT = "percent";

    private final PermissionService permissions;
    private final AuditService auditService;
    private final FinancialRecordRepository financialRecordRepository;
    private final SalesLeadRepository salesLeadRepository;
    private final SalesCustomerRepository salesCustomerRepository;
    private final ProductRepository productRepository;
    private final ComplianceItemRepository complianceItemRepository;
    private final CompanyTaskRepository taskRepository;
    private final EmployeeRepository employeeRepository;
    private final DepartmentRepository departmentRepository;
    private final LeaveRequestRepository leaveRequestRepository;
    private final AttendanceRecordRepository attendanceRecordRepository;
    private final PayrollSummaryRepository payrollSummaryRepository;
    private final ExitRecordRepository exitRecordRepository;
    private final LegalContractRepository legalContractRepository;
    private final LegalRiskLinkRepository legalRiskLinkRepository;
    private final ProcurementVendorRepository procurementVendorRepository;
    private final VendorBillRepository vendorBillRepository;
    private final ProcurementSubscriptionRepository procurementSubscriptionRepository;
    private final CompanyAssetRepository companyAssetRepository;
    private final SoftwareLicenseRepository softwareLicenseRepository;

    public AnalyticsService(
        PermissionService permissions,
        AuditService auditService,
        FinancialRecordRepository financialRecordRepository,
        SalesLeadRepository salesLeadRepository,
        SalesCustomerRepository salesCustomerRepository,
        ProductRepository productRepository,
        ComplianceItemRepository complianceItemRepository,
        CompanyTaskRepository taskRepository,
        EmployeeRepository employeeRepository,
        DepartmentRepository departmentRepository,
        LeaveRequestRepository leaveRequestRepository,
        AttendanceRecordRepository attendanceRecordRepository,
        PayrollSummaryRepository payrollSummaryRepository,
        ExitRecordRepository exitRecordRepository,
        LegalContractRepository legalContractRepository,
        LegalRiskLinkRepository legalRiskLinkRepository,
        ProcurementVendorRepository procurementVendorRepository,
        VendorBillRepository vendorBillRepository,
        ProcurementSubscriptionRepository procurementSubscriptionRepository,
        CompanyAssetRepository companyAssetRepository,
        SoftwareLicenseRepository softwareLicenseRepository
    ) {
        this.permissions = permissions;
        this.auditService = auditService;
        this.financialRecordRepository = financialRecordRepository;
        this.salesLeadRepository = salesLeadRepository;
        this.salesCustomerRepository = salesCustomerRepository;
        this.productRepository = productRepository;
        this.complianceItemRepository = complianceItemRepository;
        this.taskRepository = taskRepository;
        this.employeeRepository = employeeRepository;
        this.departmentRepository = departmentRepository;
        this.leaveRequestRepository = leaveRequestRepository;
        this.attendanceRecordRepository = attendanceRecordRepository;
        this.payrollSummaryRepository = payrollSummaryRepository;
        this.exitRecordRepository = exitRecordRepository;
        this.legalContractRepository = legalContractRepository;
        this.legalRiskLinkRepository = legalRiskLinkRepository;
        this.procurementVendorRepository = procurementVendorRepository;
        this.vendorBillRepository = vendorBillRepository;
        this.procurementSubscriptionRepository = procurementSubscriptionRepository;
        this.companyAssetRepository = companyAssetRepository;
        this.softwareLicenseRepository = softwareLicenseRepository;
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse executive(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        LocalDate today = LocalDate.now();
        List<FinancialRecord> financialRecords = financialRecords(from, to);
        List<SalesLead> leads = salesLeads(from, to);
        List<SalesCustomer> customers = salesCustomers(from, to);
        List<CompanyProduct> products = products(from, to);
        List<ComplianceItem> complianceItems = complianceItems(from, to);
        List<CompanyTask> tasks = tasks(from, to);
        List<Employee> employees = employees(from, to);
        List<LegalContract> contracts = legalContracts(from, to);
        List<ProcurementVendor> vendors = vendors(from, to);
        List<VendorBill> bills = vendorBills(from, to);
        List<CompanyAsset> assets = assets(from, to);

        List<AnalyticsMetric> kpis = List.of(
            moneyMetric("Revenue", sum(financialRecords, FinancialRecord::getRevenue)),
            moneyMetric("Expenses", sum(financialRecords, FinancialRecord::getExpenses)),
            moneyMetric("Profit / Loss", sum(financialRecords, FinancialRecord::getProfitOrLoss)),
            countMetric("Open tasks", count(tasks, this::isOpenTask)),
            countMetric("Compliance alerts", count(complianceItems, item -> isOverdueCompliance(item, today))),
            countMetric("Active products", count(products, this::isActiveProduct)),
            countMetric("Active employees", count(employees, this::isActiveEmployee)),
            countMetric("Active vendors", count(vendors, vendor -> vendor.getStatus() == ProcurementStatus.ACTIVE)),
            countMetric("Active contracts", count(contracts, this::isActiveContract)),
            countMetric("Tracked assets", assets.size())
        );

        List<AnalyticsRiskIndicator> risks = List.of(
            risk("Overdue compliance", count(complianceItems, item -> isOverdueCompliance(item, today)), "HIGH", "Compliance items past due date."),
            risk("Blocked tasks", count(tasks, task -> task.getStatus() == TaskStatus.BLOCKED), "MEDIUM", "Tasks currently blocked."),
            risk("Overdue vendor bills", count(bills, bill -> isOverdueBill(bill, today)), "MEDIUM", "Vendor bills past due date."),
            risk("Legal risks", count(legalRisks(from, to), this::isHighLegalRisk), "HIGH", "High or critical legal risk links.")
        );

        List<AnalyticsDataset> sections = List.of(
            dataset("Company health", kpis, List.of(), risks, List.of("Calculated from stored KRAVIA Company OS records only.")),
            dataset("Pipeline mix", List.of(), distribution(leads, SalesLead::getStage), List.of(), List.of()),
            dataset("Product readiness", List.of(percentMetric("Average readiness", averageReadiness(products))), productReadiness(products), List.of(), List.of())
        );

        List<String> emptyStates = new ArrayList<>();
        if (financialRecords.isEmpty() && leads.isEmpty() && products.isEmpty() && complianceItems.isEmpty() && tasks.isEmpty()) {
            emptyStates.add("No analytics records are available yet.");
        }
        return response(AnalyticsModule.EXECUTIVE, from, to, kpis, sections, risks, emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse finance(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        List<FinancialRecord> records = financialRecords(from, to);
        List<AnalyticsMetric> kpis = List.of(
            moneyMetric("Revenue", sum(records, FinancialRecord::getRevenue)),
            moneyMetric("Expenses", sum(records, FinancialRecord::getExpenses)),
            moneyMetric("Profit / Loss", sum(records, FinancialRecord::getProfitOrLoss)),
            moneyMetric("Cash balance", latestMoney(records, FinancialRecord::getCashBalance)),
            moneyMetric("Receivables", sum(records, FinancialRecord::getReceivables)),
            moneyMetric("Payables", sum(records, FinancialRecord::getPayables)),
            moneyMetric("Net GST position", sum(records, FinancialRecord::getNetGstPosition))
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("Financial summary", kpis, financeTrends(records), List.of(), List.of("Profit / loss and GST positions are calculated from stored financial records."))
        );
        List<String> emptyStates = records.isEmpty() ? List.of("No financial records have been added yet.") : List.of();
        return response(AnalyticsModule.FINANCE, from, to, kpis, sections, List.of(), emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse sales(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        LocalDate today = LocalDate.now();
        List<SalesLead> leads = salesLeads(from, to);
        List<SalesCustomer> customers = salesCustomers(from, to);
        long won = count(leads, lead -> lead.getStage() == LeadStage.WON);
        long lost = count(leads, lead -> lead.getStage() == LeadStage.LOST);
        BigDecimal conversion = won + lost == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(won)
            .multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(won + lost), 2, RoundingMode.HALF_UP);
        List<AnalyticsMetric> kpis = List.of(
            countMetric("Total leads", leads.size()),
            countMetric("Active opportunities", count(leads, this::isActiveLead)),
            countMetric("Demo scheduled", count(leads, lead -> lead.getStage() == LeadStage.DEMO_SCHEDULED)),
            countMetric("Proposals sent", count(leads, lead -> lead.getStage() == LeadStage.PROPOSAL_SENT)),
            countMetric("Won customers", won),
            countMetric("Lost leads", lost),
            percentMetric("Conversion rate", conversion),
            countMetric("Customers", customers.size()),
            countMetric("Follow-ups due", count(leads, lead -> dueOrOverdue(lead.getNextFollowUpDate(), today)))
        );
        List<AnalyticsRiskIndicator> risks = List.of(
            risk("Follow-ups due", count(leads, lead -> dueOrOverdue(lead.getNextFollowUpDate(), today)), "MEDIUM", "Sales leads requiring follow-up.")
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("Sales pipeline", kpis, distribution(leads, SalesLead::getStage), risks, List.of())
        );
        List<String> emptyStates = leads.isEmpty() && customers.isEmpty() ? List.of("No sales records have been added yet.") : List.of();
        return response(AnalyticsModule.SALES, from, to, kpis, sections, risks, emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse products(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        List<CompanyProduct> records = products(from, to);
        long withRisks = count(records, product -> hasText(product.getRisks()));
        List<AnalyticsMetric> kpis = List.of(
            countMetric("Active products", count(records, this::isActiveProduct)),
            countMetric("Launch-ready products", count(records, product -> product.getStatus() == ProductStatus.LAUNCH_READY)),
            countMetric("Live products", count(records, product -> product.getStatus() == ProductStatus.LIVE)),
            countMetric("Paused products", count(records, product -> product.getStatus() == ProductStatus.PAUSED)),
            countMetric("Products with risks", withRisks),
            percentMetric("Average readiness", averageReadiness(records))
        );
        List<AnalyticsRiskIndicator> risks = List.of(
            risk("Product risks", withRisks, "MEDIUM", "Products with recorded risk notes.")
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("Product analytics", kpis, productReadiness(records), risks, List.of())
        );
        List<String> emptyStates = records.isEmpty() ? List.of("No product records have been added yet.") : List.of();
        return response(AnalyticsModule.PRODUCTS, from, to, kpis, sections, risks, emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse compliance(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        LocalDate today = LocalDate.now();
        List<ComplianceItem> records = complianceItems(from, to);
        long overdue = count(records, item -> isOverdueCompliance(item, today));
        long upcoming = count(records, item -> isUpcoming(item.getDueDate(), today, 30) && isOpenCompliance(item));
        List<AnalyticsMetric> kpis = List.of(
            countMetric("Total compliance items", records.size()),
            countMetric("Open items", count(records, this::isOpenCompliance)),
            countMetric("Overdue items", overdue),
            countMetric("Upcoming due", upcoming),
            countMetric("Completed items", count(records, item -> item.getStatus() == ComplianceStatus.COMPLETED)),
            countMetric("Waiting for CA", count(records, item -> item.getStatus() == ComplianceStatus.WAITING_FOR_CA))
        );
        List<AnalyticsRiskIndicator> risks = List.of(
            risk("Overdue compliance", overdue, "HIGH", "Open compliance items past due date."),
            risk("Upcoming compliance", upcoming, "MEDIUM", "Open compliance items due in the next 30 days.")
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("Compliance risk", kpis, distribution(records, ComplianceItem::getStatus), risks, List.of())
        );
        List<String> emptyStates = records.isEmpty() ? List.of("No compliance items have been added yet.") : List.of();
        return response(AnalyticsModule.COMPLIANCE, from, to, kpis, sections, risks, emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse hr(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        LocalDate today = LocalDate.now();
        List<Employee> employees = employees(from, to);
        List<LeaveRequest> leaveRequests = leaveRequests(from, to);
        List<AttendanceRecord> attendanceRecords = attendanceRecords(from, to);
        List<ExitRecord> exits = exitRecords(from, to);
        List<AnalyticsMetric> kpis = List.of(
            countMetric("Employees", employees.size()),
            countMetric("Active employees", count(employees, this::isActiveEmployee)),
            countMetric("Departments", departmentRepository.count()),
            countMetric("Pending leave", count(leaveRequests, leave -> leave.getStatus() == LeaveStatus.REQUESTED || leave.getStatus() == LeaveStatus.MANAGER_REVIEW)),
            countMetric("Attendance records today", count(attendanceRecords, record -> today.equals(record.getAttendanceDate()))),
            countMetric("Payroll summaries", payrollSummaryRepository.count()),
            countMetric("Open exits", count(exits, exit -> exit.getStatus() != ExitStatus.COMPLETED && exit.getStatus() != ExitStatus.ARCHIVED))
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("HR analytics", kpis, distribution(employees, Employee::getEmploymentStatus), List.of(), List.of())
        );
        List<String> emptyStates = employees.isEmpty() && leaveRequests.isEmpty() ? List.of("No HR records have been added yet.") : List.of();
        return response(AnalyticsModule.HR, from, to, kpis, sections, List.of(), emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse legal(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        LocalDate today = LocalDate.now();
        List<LegalContract> contracts = legalContracts(from, to);
        List<LegalRiskLink> legalRisks = legalRisks(from, to);
        long pendingSignatures = count(contracts, contract -> contract.getSignatureStatus() != SignatureStatus.SIGNED && contract.getSignatureStatus() != SignatureStatus.NOT_REQUIRED);
        long upcomingRenewals = count(contracts, contract -> isUpcoming(contract.getRenewalDate(), today, 30));
        long expiringAgreements = count(contracts, contract -> isUpcoming(contract.getExpiryDate(), today, 30));
        long highRisks = count(legalRisks, this::isHighLegalRisk);
        List<AnalyticsMetric> kpis = List.of(
            countMetric("Active contracts", count(contracts, this::isActiveContract)),
            countMetric("Under review", count(contracts, contract -> contract.getStatus() == LegalStatus.UNDER_REVIEW)),
            countMetric("Pending approvals", count(contracts, contract -> contract.getApprovalStatus() == LegalStatus.PENDING_APPROVAL)),
            countMetric("Pending signatures", pendingSignatures),
            countMetric("Upcoming renewals", upcomingRenewals),
            countMetric("Expiring agreements", expiringAgreements),
            countMetric("High legal risks", highRisks)
        );
        List<AnalyticsRiskIndicator> risks = List.of(
            risk("Pending signatures", pendingSignatures, "MEDIUM", "Contracts awaiting signature."),
            risk("High legal risks", highRisks, "HIGH", "Legal risks marked high or critical.")
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("Legal exposure", kpis, distribution(contracts, LegalContract::getStatus), risks, List.of())
        );
        List<String> emptyStates = contracts.isEmpty() && legalRisks.isEmpty() ? List.of("No legal records have been added yet.") : List.of();
        return response(AnalyticsModule.LEGAL, from, to, kpis, sections, risks, emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse procurement(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        LocalDate today = LocalDate.now();
        List<ProcurementVendor> vendors = vendors(from, to);
        List<VendorBill> bills = vendorBills(from, to);
        List<ProcurementSubscription> subscriptions = subscriptions(from, to);
        long overdueBills = count(bills, bill -> isOverdueBill(bill, today));
        long unpaidBills = count(bills, bill -> bill.getPaymentStatus() == ProcurementStatus.UNPAID || bill.getPaymentStatus() == ProcurementStatus.OVERDUE);
        List<AnalyticsMetric> kpis = List.of(
            countMetric("Active vendors", count(vendors, vendor -> vendor.getStatus() == ProcurementStatus.ACTIVE)),
            countMetric("Unpaid vendor bills", unpaidBills),
            countMetric("Overdue payments", overdueBills),
            moneyMetric("Vendor bill total", sum(bills, VendorBill::getTotalAmount)),
            countMetric("Active subscriptions", count(subscriptions, sub -> sub.getStatus() == ProcurementStatus.ACTIVE)),
            countMetric("Upcoming renewals", count(subscriptions, sub -> isUpcoming(sub.getRenewalDate(), today, 30)))
        );
        List<AnalyticsRiskIndicator> risks = List.of(
            risk("Overdue payments", overdueBills, "HIGH", "Vendor bills past due date."),
            risk("Upcoming renewals", count(subscriptions, sub -> isUpcoming(sub.getRenewalDate(), today, 30)), "MEDIUM", "Subscriptions renewing in the next 30 days.")
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("Procurement analytics", kpis, distribution(bills, VendorBill::getPaymentStatus), risks, List.of())
        );
        List<String> emptyStates = vendors.isEmpty() && bills.isEmpty() && subscriptions.isEmpty() ? List.of("No procurement records have been added yet.") : List.of();
        return response(AnalyticsModule.PROCUREMENT, from, to, kpis, sections, risks, emptyStates);
    }

    @Transactional(readOnly = true)
    public AnalyticsDashboardResponse operations(LocalDate from, LocalDate to, AppUser actor) {
        requireAnalyticsAccess(actor);
        LocalDate today = LocalDate.now();
        YearMonth currentMonth = YearMonth.now();
        List<CompanyTask> tasks = tasks(from, to);
        List<CompanyAsset> assets = assets(from, to);
        List<SoftwareLicense> licenses = licenses(from, to);
        List<AnalyticsMetric> kpis = List.of(
            countMetric("Open tasks", count(tasks, this::isOpenTask)),
            countMetric("Blocked tasks", count(tasks, task -> task.getStatus() == TaskStatus.BLOCKED)),
            countMetric("Completed this month", count(tasks, task -> completedInMonth(task, currentMonth))),
            countMetric("Overdue tasks", count(tasks, task -> task.getDueDate() != null && task.getDueDate().isBefore(today) && isOpenTask(task))),
            countMetric("Total assets", assets.size()),
            countMetric("Assigned assets", count(assets, asset -> asset.getStatus() == AssetStatus.ASSIGNED)),
            countMetric("Unassigned assets", count(assets, asset -> asset.getStatus() == AssetStatus.UNASSIGNED)),
            countMetric("Expiring licenses", count(licenses, license -> isUpcoming(license.getRenewalDate(), today, 30)))
        );
        List<AnalyticsRiskIndicator> risks = List.of(
            risk("Blocked tasks", count(tasks, task -> task.getStatus() == TaskStatus.BLOCKED), "MEDIUM", "Tasks blocked from completion."),
            risk("Expiring licenses", count(licenses, license -> isUpcoming(license.getRenewalDate(), today, 30)), "MEDIUM", "Software licenses renewing or expiring in the next 30 days.")
        );
        List<AnalyticsDataset> sections = List.of(
            dataset("Operational analytics", kpis, distribution(tasks, CompanyTask::getStatus), risks, List.of())
        );
        List<String> emptyStates = tasks.isEmpty() && assets.isEmpty() ? List.of("No operational records have been added yet.") : List.of();
        return response(AnalyticsModule.OPERATIONS, from, to, kpis, sections, risks, emptyStates);
    }

    @Transactional
    public AnalyticsExportResponse requestExport(AnalyticsExportRequest request, AppUser actor) {
        requireAnalyticsAccess(actor);
        auditService.record(
            actor,
            "ANALYTICS",
            "ANALYTICS_EXPORT_REQUESTED",
            "Requested " + request.format() + " export for " + request.module() + " analytics.",
            "INFO"
        );
        return new AnalyticsExportResponse(
            request.module(),
            request.format(),
            Instant.now(),
            "EXPORT_PLACEHOLDER",
            "Export request has been logged. File generation is not enabled yet."
        );
    }

    private void requireAnalyticsAccess(AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER);
    }

    private AnalyticsDashboardResponse response(
        AnalyticsModule module,
        LocalDate from,
        LocalDate to,
        List<AnalyticsMetric> kpis,
        List<AnalyticsDataset> sections,
        List<AnalyticsRiskIndicator> risks,
        List<String> emptyStates
    ) {
        return new AnalyticsDashboardResponse(module, Instant.now(), from, to, kpis, sections, risks, emptyStates);
    }

    private AnalyticsDataset dataset(
        String title,
        List<AnalyticsMetric> metrics,
        List<AnalyticsTrendPoint> trends,
        List<AnalyticsRiskIndicator> risks,
        List<String> notes
    ) {
        return new AnalyticsDataset(title, metrics, trends, risks, notes);
    }

    private AnalyticsMetric countMetric(String label, long value) {
        return metric(label, BigDecimal.valueOf(value), UNIT_COUNT, "neutral");
    }

    private AnalyticsMetric moneyMetric(String label, BigDecimal value) {
        return metric(label, money(value), UNIT_INR, money(value).signum() < 0 ? "negative" : "neutral");
    }

    private AnalyticsMetric percentMetric(String label, BigDecimal value) {
        return metric(label, money(value), UNIT_PERCENT, "neutral");
    }

    private AnalyticsMetric metric(String label, BigDecimal value, String unit, String tone) {
        return new AnalyticsMetric(label, money(value), unit, tone);
    }

    private AnalyticsRiskIndicator risk(String label, long value, String severity, String description) {
        return new AnalyticsRiskIndicator(label, value, severity, description);
    }

    private List<AnalyticsTrendPoint> financeTrends(List<FinancialRecord> records) {
        Map<String, BigDecimal> profitByMonth = records.stream()
            .filter(record -> hasText(record.getReportingMonth()))
            .collect(Collectors.groupingBy(
                FinancialRecord::getReportingMonth,
                TreeMap::new,
                Collectors.reducing(BigDecimal.ZERO, record -> money(record.getProfitOrLoss()), BigDecimal::add)
            ));
        return profitByMonth.entrySet().stream()
            .map(entry -> new AnalyticsTrendPoint(entry.getKey(), entry.getValue(), entry.getValue().signum() < 0 ? "negative" : "positive"))
            .toList();
    }

    private List<AnalyticsTrendPoint> productReadiness(List<CompanyProduct> products) {
        return products.stream()
            .filter(product -> product.getLaunchReadinessPercentage() != null)
            .sorted(Comparator.comparing(CompanyProduct::getName, Comparator.nullsLast(String::compareToIgnoreCase)))
            .map(product -> new AnalyticsTrendPoint(
                hasText(product.getName()) ? product.getName() : "Unnamed product",
                BigDecimal.valueOf(product.getLaunchReadinessPercentage()),
                product.getLaunchReadinessPercentage() >= 80 ? "positive" : "neutral"
            ))
            .toList();
    }

    private <T, E extends Enum<E>> List<AnalyticsTrendPoint> distribution(List<T> records, Function<T, E> classifier) {
        Map<String, Long> grouped = records.stream()
            .map(classifier)
            .filter(Objects::nonNull)
            .collect(Collectors.groupingBy(Enum::name, TreeMap::new, Collectors.counting()));
        return grouped.entrySet().stream()
            .map(entry -> new AnalyticsTrendPoint(entry.getKey(), BigDecimal.valueOf(entry.getValue()), "neutral"))
            .toList();
    }

    private List<FinancialRecord> financialRecords(LocalDate from, LocalDate to) {
        return financialRecordRepository.findAll().stream()
            .filter(record -> record.getArchivedAt() == null)
            .filter(record -> inDateRange(record.getUpdatedAt(), from, to))
            .toList();
    }

    private List<SalesLead> salesLeads(LocalDate from, LocalDate to) {
        return salesLeadRepository.findAll().stream()
            .filter(lead -> lead.getArchivedAt() == null)
            .filter(lead -> inDateRange(lead.getUpdatedAt(), from, to))
            .toList();
    }

    private List<SalesCustomer> salesCustomers(LocalDate from, LocalDate to) {
        return salesCustomerRepository.findAll().stream()
            .filter(customer -> customer.getArchivedAt() == null)
            .filter(customer -> inDateRange(customer.getUpdatedAt(), from, to))
            .toList();
    }

    private List<CompanyProduct> products(LocalDate from, LocalDate to) {
        return productRepository.findAll().stream()
            .filter(product -> product.getArchivedAt() == null)
            .filter(product -> inDateRange(product.getUpdatedAt(), from, to))
            .toList();
    }

    private List<ComplianceItem> complianceItems(LocalDate from, LocalDate to) {
        return complianceItemRepository.findAll().stream()
            .filter(item -> item.getArchivedAt() == null)
            .filter(item -> inDateRange(item.getUpdatedAt(), from, to))
            .toList();
    }

    private List<CompanyTask> tasks(LocalDate from, LocalDate to) {
        return taskRepository.findAll().stream()
            .filter(task -> task.getArchivedAt() == null)
            .filter(task -> inDateRange(task.getUpdatedAt(), from, to))
            .toList();
    }

    private List<Employee> employees(LocalDate from, LocalDate to) {
        return employeeRepository.findAll().stream()
            .filter(employee -> employee.getArchivedAt() == null)
            .filter(employee -> inDateRange(employee.getUpdatedAt(), from, to))
            .toList();
    }

    private List<LeaveRequest> leaveRequests(LocalDate from, LocalDate to) {
        return leaveRequestRepository.findAll().stream()
            .filter(request -> request.getArchivedAt() == null)
            .filter(request -> inDateRange(request.getUpdatedAt(), from, to))
            .toList();
    }

    private List<AttendanceRecord> attendanceRecords(LocalDate from, LocalDate to) {
        return attendanceRecordRepository.findAll().stream()
            .filter(record -> record.getArchivedAt() == null)
            .filter(record -> inDateRange(record.getUpdatedAt(), from, to))
            .toList();
    }

    private List<ExitRecord> exitRecords(LocalDate from, LocalDate to) {
        return exitRecordRepository.findAll().stream()
            .filter(record -> record.getArchivedAt() == null)
            .filter(record -> inDateRange(record.getUpdatedAt(), from, to))
            .toList();
    }

    private List<LegalContract> legalContracts(LocalDate from, LocalDate to) {
        return legalContractRepository.findAll().stream()
            .filter(contract -> contract.getArchivedAt() == null)
            .filter(contract -> inDateRange(contract.getUpdatedAt(), from, to))
            .toList();
    }

    private List<LegalRiskLink> legalRisks(LocalDate from, LocalDate to) {
        return legalRiskLinkRepository.findAll().stream()
            .filter(risk -> risk.getArchivedAt() == null)
            .filter(risk -> inDateRange(risk.getUpdatedAt(), from, to))
            .toList();
    }

    private List<ProcurementVendor> vendors(LocalDate from, LocalDate to) {
        return procurementVendorRepository.findAll().stream()
            .filter(vendor -> vendor.getArchivedAt() == null)
            .filter(vendor -> inDateRange(vendor.getUpdatedAt(), from, to))
            .toList();
    }

    private List<VendorBill> vendorBills(LocalDate from, LocalDate to) {
        return vendorBillRepository.findAll().stream()
            .filter(bill -> bill.getArchivedAt() == null)
            .filter(bill -> inDateRange(bill.getUpdatedAt(), from, to))
            .toList();
    }

    private List<ProcurementSubscription> subscriptions(LocalDate from, LocalDate to) {
        return procurementSubscriptionRepository.findAll().stream()
            .filter(subscription -> subscription.getArchivedAt() == null)
            .filter(subscription -> inDateRange(subscription.getUpdatedAt(), from, to))
            .toList();
    }

    private List<CompanyAsset> assets(LocalDate from, LocalDate to) {
        return companyAssetRepository.findAll().stream()
            .filter(asset -> asset.getArchivedAt() == null)
            .filter(asset -> inDateRange(asset.getUpdatedAt(), from, to))
            .toList();
    }

    private List<SoftwareLicense> licenses(LocalDate from, LocalDate to) {
        return softwareLicenseRepository.findAll().stream()
            .filter(license -> license.getArchivedAt() == null)
            .filter(license -> inDateRange(license.getUpdatedAt(), from, to))
            .toList();
    }

    private boolean inDateRange(Instant updatedAt, LocalDate from, LocalDate to) {
        if (updatedAt == null) {
            return true;
        }
        LocalDate updatedDate = updatedAt.atZone(ZoneOffset.UTC).toLocalDate();
        return (from == null || !updatedDate.isBefore(from)) && (to == null || !updatedDate.isAfter(to));
    }

    private BigDecimal latestMoney(List<FinancialRecord> records, Function<FinancialRecord, BigDecimal> extractor) {
        return records.stream()
            .max(Comparator.comparing(FinancialRecord::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .map(extractor)
            .map(this::money)
            .orElse(BigDecimal.ZERO);
    }

    private <T> BigDecimal sum(List<T> records, Function<T, BigDecimal> extractor) {
        return records.stream()
            .map(extractor)
            .map(this::money)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal averageReadiness(List<CompanyProduct> products) {
        List<Integer> values = products.stream()
            .map(CompanyProduct::getLaunchReadinessPercentage)
            .filter(Objects::nonNull)
            .toList();
        if (values.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal total = values.stream()
            .map(BigDecimal::valueOf)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        return total.divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private <T> long count(List<T> records, Predicate<T> predicate) {
        return records.stream().filter(predicate).count();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private boolean isActiveLead(SalesLead lead) {
        return lead.getStage() != null && lead.getStage() != LeadStage.WON && lead.getStage() != LeadStage.LOST && lead.getStage() != LeadStage.ARCHIVED;
    }

    private boolean isActiveProduct(CompanyProduct product) {
        return product.getStatus() != ProductStatus.ARCHIVED && product.getStatus() != ProductStatus.PAUSED;
    }

    private boolean isOpenTask(CompanyTask task) {
        return task.getStatus() != TaskStatus.DONE && task.getStatus() != TaskStatus.ARCHIVED;
    }

    private boolean isOpenCompliance(ComplianceItem item) {
        ComplianceStatus status = item.getStatus();
        return status != ComplianceStatus.APPROVED
            && status != ComplianceStatus.COMPLETED
            && status != ComplianceStatus.NOT_APPLICABLE
            && status != ComplianceStatus.ARCHIVED;
    }

    private boolean isOverdueCompliance(ComplianceItem item, LocalDate today) {
        return item.getDueDate() != null && item.getDueDate().isBefore(today) && isOpenCompliance(item);
    }

    private boolean isActiveEmployee(Employee employee) {
        EmploymentStatus status = employee.getEmploymentStatus();
        return status == EmploymentStatus.ACTIVE
            || status == EmploymentStatus.PROBATION
            || status == EmploymentStatus.ON_LEAVE
            || status == EmploymentStatus.NOTICE_PERIOD;
    }

    private boolean isActiveContract(LegalContract contract) {
        return contract.getStatus() == LegalStatus.ACTIVE
            || contract.getStatus() == LegalStatus.SIGNED
            || contract.getStatus() == LegalStatus.APPROVED;
    }

    private boolean isHighLegalRisk(LegalRiskLink risk) {
        return risk.getSeverity() == LegalRiskSeverity.HIGH || risk.getSeverity() == LegalRiskSeverity.CRITICAL;
    }

    private boolean isOverdueBill(VendorBill bill, LocalDate today) {
        if (bill.getPaymentStatus() == ProcurementStatus.OVERDUE) {
            return true;
        }
        return bill.getDueDate() != null && bill.getDueDate().isBefore(today) && bill.getPaymentStatus() != ProcurementStatus.PAID;
    }

    private boolean dueOrOverdue(LocalDate date, LocalDate today) {
        return date != null && !date.isAfter(today);
    }

    private boolean isUpcoming(LocalDate date, LocalDate today, int days) {
        return date != null && !date.isBefore(today) && !date.isAfter(today.plusDays(days));
    }

    private boolean completedInMonth(CompanyTask task, YearMonth month) {
        return task.getCompletedAt() != null && YearMonth.from(task.getCompletedAt().atZone(ZoneOffset.UTC)).equals(month);
    }
}
