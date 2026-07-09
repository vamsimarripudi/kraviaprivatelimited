package com.kravia.companyos.analytics;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class AnalyticsDto {
    private AnalyticsDto() {}

    public enum AnalyticsModule {
        EXECUTIVE,
        FINANCE,
        SALES,
        PRODUCTS,
        COMPLIANCE,
        HR,
        LEGAL,
        PROCUREMENT,
        OPERATIONS
    }

    public enum AnalyticsExportFormat {
        PDF,
        EXCEL,
        CSV
    }

    public record AnalyticsMetric(String label, BigDecimal value, String unit, String tone) {}

    public record AnalyticsTrendPoint(String label, BigDecimal value, String tone) {}

    public record AnalyticsRiskIndicator(String label, long value, String severity, String description) {}

    public record AnalyticsDataset(
        String title,
        List<AnalyticsMetric> metrics,
        List<AnalyticsTrendPoint> trends,
        List<AnalyticsRiskIndicator> risks,
        List<String> notes
    ) {}

    public record AnalyticsDashboardResponse(
        AnalyticsModule module,
        Instant generatedAt,
        LocalDate from,
        LocalDate to,
        List<AnalyticsMetric> kpis,
        List<AnalyticsDataset> sections,
        List<AnalyticsRiskIndicator> risks,
        List<String> emptyStates
    ) {}

    public record AnalyticsExportRequest(
        @NotNull AnalyticsModule module,
        @NotNull AnalyticsExportFormat format,
        LocalDate from,
        LocalDate to
    ) {}

    public record AnalyticsExportResponse(
        AnalyticsModule module,
        AnalyticsExportFormat format,
        Instant requestedAt,
        String status,
        String message
    ) {}
}
