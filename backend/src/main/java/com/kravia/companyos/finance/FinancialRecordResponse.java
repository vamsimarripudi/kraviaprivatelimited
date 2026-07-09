package com.kravia.companyos.finance;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;

public record FinancialRecordResponse(
    UUID id,
    String reportingMonth,
    BigDecimal revenue,
    BigDecimal expenses,
    BigDecimal profitOrLoss,
    BigDecimal cashBalance,
    BigDecimal receivables,
    BigDecimal payables,
    BigDecimal gstCollected,
    BigDecimal gstPaid,
    BigDecimal netGstPosition,
    BigDecimal cloudSubscriptions,
    BigDecimal vendorPayments,
    BigDecimal directorRemuneration,
    String founderNotes,
    FinancialRecordStatus status,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt
) {
    public static FinancialRecordResponse from(FinancialRecord record) {
        return new FinancialRecordResponse(
            record.getId(),
            record.getReportingMonth(),
            record.getRevenue(),
            record.getExpenses(),
            record.getProfitOrLoss(),
            record.getCashBalance(),
            record.getReceivables(),
            record.getPayables(),
            record.getGstCollected(),
            record.getGstPaid(),
            record.getNetGstPosition(),
            record.getCloudSubscriptions(),
            record.getVendorPayments(),
            record.getDirectorRemuneration(),
            record.getFounderNotes(),
            record.getStatus(),
            record.getCreatedBy(),
            record.getCreatedAt(),
            record.getUpdatedAt(),
            record.getArchivedAt()
        );
    }
}
