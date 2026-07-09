package com.kravia.companyos.platform;

import com.kravia.companyos.user.AppUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/platform/dashboard")
public class ExecutiveDashboardController {
    private final ExecutiveDashboardService service;

    public ExecutiveDashboardController(ExecutiveDashboardService service) {
        this.service = service;
    }

    @GetMapping
    public ExecutiveDashboardResponse get(@AuthenticationPrincipal AppUser actor) {
        return service.getDashboard(actor);
    }
}
