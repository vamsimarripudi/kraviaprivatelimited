package com.kravia.companyos.analytics;

import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsDashboardResponse;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsExportRequest;
import com.kravia.companyos.analytics.AnalyticsDto.AnalyticsExportResponse;
import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/analytics")
public class AnalyticsController {
    private final AnalyticsService service;

    public AnalyticsController(AnalyticsService service) {
        this.service = service;
    }

    @GetMapping("/executive")
    public AnalyticsDashboardResponse executive(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.executive(from, to, actor);
    }

    @GetMapping("/finance")
    public AnalyticsDashboardResponse finance(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.finance(from, to, actor);
    }

    @GetMapping("/sales")
    public AnalyticsDashboardResponse sales(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.sales(from, to, actor);
    }

    @GetMapping("/products")
    public AnalyticsDashboardResponse products(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.products(from, to, actor);
    }

    @GetMapping("/compliance")
    public AnalyticsDashboardResponse compliance(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.compliance(from, to, actor);
    }

    @GetMapping("/hr")
    public AnalyticsDashboardResponse hr(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.hr(from, to, actor);
    }

    @GetMapping("/legal")
    public AnalyticsDashboardResponse legal(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.legal(from, to, actor);
    }

    @GetMapping("/procurement")
    public AnalyticsDashboardResponse procurement(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.procurement(from, to, actor);
    }

    @GetMapping("/operations")
    public AnalyticsDashboardResponse operations(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.operations(from, to, actor);
    }

    @PostMapping("/export")
    public AnalyticsExportResponse export(@Valid @RequestBody AnalyticsExportRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.requestExport(request, actor);
    }
}
