package com.kravia.companyos.governance;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/governance")
public class GovernanceController {
    private final GovernanceDashboardService dashboardService;
    private final AccessReviewService accessReviewService;

    public GovernanceController(GovernanceDashboardService dashboardService, AccessReviewService accessReviewService) {
        this.dashboardService = dashboardService;
        this.accessReviewService = accessReviewService;
    }

    @GetMapping("/dashboard")
    public GovernanceDashboardResponse dashboard(@AuthenticationPrincipal AppUser actor) {
        return dashboardService.dashboard(actor);
    }

    @GetMapping("/access-review")
    public List<AccessReviewResponse> accessReview(@RequestParam(required = false) String quarter, @AuthenticationPrincipal AppUser actor) {
        return accessReviewService.list(quarter, actor);
    }

    @PatchMapping("/access-review/{userId}")
    public AccessReviewResponse review(@PathVariable UUID userId, @Valid @RequestBody AccessReviewRequest request, @AuthenticationPrincipal AppUser actor) {
        return accessReviewService.review(userId, request, actor);
    }
}
