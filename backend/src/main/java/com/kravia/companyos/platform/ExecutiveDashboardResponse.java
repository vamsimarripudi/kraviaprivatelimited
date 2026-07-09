package com.kravia.companyos.platform;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ExecutiveDashboardResponse(
    CompanyOverview companyOverview,
    FinancialHighlights financialHighlights,
    List<DashboardMetric> metrics,
    List<DashboardItem> pendingApprovals,
    List<DashboardItem> complianceAlerts,
    List<DashboardItem> upcomingMeetings,
    List<DashboardItem> openTasks,
    ProductProgress productProgress,
    List<DashboardItem> recentDocuments,
    List<DashboardItem> notifications,
    List<String> aiInsights
) {
    public record CompanyOverview(String companyName, String companyStatus, Instant updatedAt) {}

    public record FinancialHighlights(
        boolean available,
        String reportingMonth,
        BigDecimal revenue,
        BigDecimal expenses,
        BigDecimal profitOrLoss,
        BigDecimal cashBalance,
        BigDecimal netGstPosition
    ) {}

    public record DashboardMetric(String label, long value) {}

    public record DashboardItem(UUID id, String module, String title, String status, String dateLabel) {}

    public record ProductProgress(long totalProducts, long activeProducts, long launchReadyProducts, long productsWithRisks, int averageLaunchReadiness) {}
}
