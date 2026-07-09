package com.kravia.companyos.finance;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinancialRecordService {
    private static final String MODULE = "FINANCIAL_RECORDS";
    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final FinancialRecordRepository records;
    private final PermissionService permissions;
    private final AuditService auditService;

    public FinancialRecordService(FinancialRecordRepository records, PermissionService permissions, AuditService auditService) {
        this.records = records;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<FinancialRecordResponse> list(String query, Integer reportingYear, Integer reportingMonth, AppUser actor) {
        requireViewer(actor);
        String yearFilter = reportingYear == null ? null : String.format("%04d", reportingYear);
        String monthFilter = reportingMonth == null ? null : String.format("%02d", reportingMonth);
        return records.search(normalizeQuery(query), yearFilter, monthFilter).stream().map(FinancialRecordResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public FinancialRecordResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return FinancialRecordResponse.from(find(id));
    }

    @Transactional
    public FinancialRecordResponse create(FinancialRecordRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        FinancialRecord record = new FinancialRecord();
        record.setCreatedBy(actor.getDisplayName());
        apply(record, request);
        FinancialRecord saved = records.saveAndFlush(record);
        auditService.record(actor, MODULE, "FINANCIAL_RECORD_CREATED", "Created financial record for " + saved.getReportingMonth(), "IMPORTANT");
        return FinancialRecordResponse.from(saved);
    }

    @Transactional
    public FinancialRecordResponse update(UUID id, FinancialRecordRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        FinancialRecord record = find(id);
        ensureEditable(record);
        if (request.status() == FinancialRecordStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        apply(record, request);
        if (record.getStatus() == FinancialRecordStatus.ARCHIVED) record.setArchivedAt(Instant.now());
        FinancialRecord saved = records.saveAndFlush(record);
        auditService.record(actor, MODULE, "FINANCIAL_RECORD_UPDATED", "Updated financial record for " + saved.getReportingMonth(), "IMPORTANT");
        return FinancialRecordResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        FinancialRecord record = find(id);
        if (record.getStatus() != FinancialRecordStatus.ARCHIVED) {
            record.setStatus(FinancialRecordStatus.ARCHIVED);
            record.setArchivedAt(Instant.now());
        }
        auditService.record(actor, MODULE, "FINANCIAL_RECORD_ARCHIVED", "Archived financial record for " + record.getReportingMonth(), "WARNING");
    }

    private void apply(FinancialRecord record, FinancialRecordRequest request) {
        BigDecimal revenue = money(request.revenue(), "Revenue");
        BigDecimal expenses = money(request.expenses(), "Expenses");
        BigDecimal gstCollected = money(request.gstCollected(), "GST collected");
        BigDecimal gstPaid = money(request.gstPaid(), "GST paid");

        record.setReportingMonth(request.reportingMonth().trim());
        record.setRevenue(revenue);
        record.setExpenses(expenses);
        record.setProfitOrLoss(revenue.subtract(expenses).setScale(2, RoundingMode.HALF_UP));
        record.setCashBalance(optionalMoney(request.cashBalance(), "Cash balance"));
        record.setReceivables(optionalMoney(request.receivables(), "Receivables"));
        record.setPayables(optionalMoney(request.payables(), "Payables"));
        record.setGstCollected(gstCollected);
        record.setGstPaid(gstPaid);
        record.setNetGstPosition(gstCollected.subtract(gstPaid).setScale(2, RoundingMode.HALF_UP));
        record.setCloudSubscriptions(optionalMoney(request.cloudSubscriptions(), "Cloud/software subscriptions"));
        record.setVendorPayments(optionalMoney(request.vendorPayments(), "Vendor payments"));
        record.setDirectorRemuneration(optionalMoney(request.directorRemuneration(), "Director remuneration"));
        record.setFounderNotes(blankToNull(request.founderNotes()));
        record.setStatus(request.status());
    }

    private void validateRequest(FinancialRecordRequest request) {
        if (request.reportingMonth() == null || request.reportingMonth().isBlank()) throw new IllegalArgumentException("Reporting month is required.");
        try {
            YearMonth.parse(request.reportingMonth().trim());
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("Reporting month must use YYYY-MM format.");
        }
        if (request.status() == null) throw new IllegalArgumentException("Financial record status is required.");
        money(request.revenue(), "Revenue");
        money(request.expenses(), "Expenses");
        money(request.gstCollected(), "GST collected");
        money(request.gstPaid(), "GST paid");
        optionalMoney(request.cashBalance(), "Cash balance");
        optionalMoney(request.receivables(), "Receivables");
        optionalMoney(request.payables(), "Payables");
        optionalMoney(request.cloudSubscriptions(), "Cloud/software subscriptions");
        optionalMoney(request.vendorPayments(), "Vendor payments");
        optionalMoney(request.directorRemuneration(), "Director remuneration");
    }

    private BigDecimal money(BigDecimal value, String label) {
        if (value == null) throw new IllegalArgumentException(label + " is required.");
        return normalizeMoney(value, label);
    }

    private BigDecimal optionalMoney(BigDecimal value, String label) {
        if (value == null) return ZERO;
        return normalizeMoney(value, label);
    }

    private BigDecimal normalizeMoney(BigDecimal value, String label) {
        if (value.scale() > 2) throw new IllegalArgumentException(label + " must have no more than 2 decimal places.");
        if (value.signum() < 0) throw new IllegalArgumentException(label + " cannot be negative.");
        if (value.precision() - value.scale() > 17) throw new IllegalArgumentException(label + " is too large.");
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private void ensureEditable(FinancialRecord record) {
        if (record.getStatus() == FinancialRecordStatus.ARCHIVED) throw new ForbiddenOperationException("Archived financial records cannot be edited.");
    }

    private FinancialRecord find(UUID id) {
        return records.findById(id).orElseThrow(() -> new NotFoundException("Financial record not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalizeQuery(String query) { return query == null ? null : query.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
