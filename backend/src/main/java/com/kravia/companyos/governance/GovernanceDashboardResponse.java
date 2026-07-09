package com.kravia.companyos.governance;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record GovernanceDashboardResponse(
    List<GovernanceMetric> metrics,
    List<GovernanceActivityItem> recentGovernanceActivity,
    String accessReviewQuarter,
    String accessReviewStatus,
    String complianceEvidenceStatus
) {
    public record GovernanceMetric(String label, long value) {}
    public record GovernanceActivityItem(UUID id, String module, String action, String description, String actor, Instant timestamp) {}
}
