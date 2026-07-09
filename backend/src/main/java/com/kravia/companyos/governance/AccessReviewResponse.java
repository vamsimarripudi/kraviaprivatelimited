package com.kravia.companyos.governance;

import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.UUID;

public record AccessReviewResponse(
    UUID userId,
    String email,
    String displayName,
    String roles,
    boolean enabled,
    Instant lastLoginAt,
    boolean inactive,
    String quarterLabel,
    AccessReviewStatus reviewStatus,
    String reviewedBy,
    Instant reviewedAt,
    String notes
) {
    public static AccessReviewResponse from(AppUser user, AccessReviewRecord review, String quarterLabel, boolean inactive) {
        return new AccessReviewResponse(
            user.getId(),
            user.getEmail(),
            user.getDisplayName(),
            user.roleSummary(),
            user.isEnabled(),
            user.getLastLoginAt(),
            inactive,
            quarterLabel,
            review == null ? AccessReviewStatus.PENDING_REVIEW : review.getReviewStatus(),
            review == null ? null : review.getReviewedBy(),
            review == null ? null : review.getReviewedAt(),
            review == null ? null : review.getNotes()
        );
    }
}
