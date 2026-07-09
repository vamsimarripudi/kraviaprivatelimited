package com.kravia.companyos.governance;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccessReviewService {
    private static final String MODULE = "ACCESS_REVIEW";

    private final UserRepository users;
    private final AccessReviewRepository reviews;
    private final PermissionService permissions;
    private final AuditService auditService;

    public AccessReviewService(UserRepository users, AccessReviewRepository reviews, PermissionService permissions, AuditService auditService) {
        this.users = users;
        this.reviews = reviews;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AccessReviewResponse> list(String quarter, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
        String quarterLabel = quarter == null || quarter.isBlank() ? currentQuarter() : quarter.trim().toUpperCase();
        return users.findAll().stream()
            .sorted(Comparator.comparing(AppUser::getEmail))
            .map(user -> AccessReviewResponse.from(user, reviews.findByUserIdAndQuarterLabel(user.getId(), quarterLabel).orElse(null), quarterLabel, isInactive(user)))
            .toList();
    }

    @Transactional
    public AccessReviewResponse review(UUID userId, AccessReviewRequest request, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
        AppUser user = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found."));
        String quarterLabel = currentQuarter();
        AccessReviewRecord review = reviews.findByUserIdAndQuarterLabel(userId, quarterLabel).orElseGet(AccessReviewRecord::new);
        review.setUser(user);
        review.setQuarterLabel(quarterLabel);
        review.setReviewStatus(request.reviewStatus());
        review.setReviewedBy(actor.getDisplayName());
        review.setReviewedAt(Instant.now());
        review.setNotes(blankToNull(request.notes()));
        AccessReviewRecord saved = reviews.saveAndFlush(review);
        auditService.record(actor, MODULE, "ACCESS_REVIEW_UPDATED", "Updated access review for " + user.getEmail(), "IMPORTANT");
        return AccessReviewResponse.from(user, saved, quarterLabel, isInactive(user));
    }

    public String currentQuarter() {
        LocalDate today = LocalDate.now();
        int quarter = ((today.getMonthValue() - 1) / 3) + 1;
        return today.getYear() + "-Q" + quarter;
    }

    public boolean isInactive(AppUser user) {
        return !user.isEnabled() || user.getLastLoginAt() == null || user.getLastLoginAt().isBefore(Instant.now().minusSeconds(90L * 24 * 60 * 60));
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
