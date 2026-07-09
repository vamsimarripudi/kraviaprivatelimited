package com.kravia.companyos.report;

import com.kravia.companyos.user.AppUser;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/reports")
public class ReportController {
    private final ReportService service;

    public ReportController(ReportService service) { this.service = service; }

    @GetMapping("/company-summary")
    public ReportResponse companySummary(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.companySummary(filters(from, to, module), actor);
    }

    @GetMapping("/financial-summary")
    public ReportResponse financialSummary(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.financialSummary(filters(from, to, module), actor);
    }

    @GetMapping("/profit-loss")
    public ReportResponse profitLoss(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.profitLoss(filters(from, to, module), actor);
    }

    @GetMapping("/board-meetings")
    public ReportResponse boardMeetings(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.boardMeetings(filters(from, to, module), actor);
    }

    @GetMapping("/compliance")
    public ReportResponse compliance(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.compliance(filters(from, to, module), actor);
    }

    @GetMapping("/tasks")
    public ReportResponse tasks(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.tasks(filters(from, to, module), actor);
    }

    @GetMapping("/products")
    public ReportResponse products(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.products(filters(from, to, module), actor);
    }

    @GetMapping("/documents")
    public ReportResponse documents(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.documents(filters(from, to, module), actor);
    }

    @GetMapping("/contacts")
    public ReportResponse contacts(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.contacts(filters(from, to, module), actor);
    }

    @GetMapping("/activity")
    public ReportResponse activity(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from, @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to, @RequestParam(required = false) String module, @AuthenticationPrincipal AppUser actor) {
        return service.activity(filters(from, to, module), actor);
    }

    private ReportFilters filters(LocalDate from, LocalDate to, String module) {
        if (from != null && to != null && from.isAfter(to)) throw new IllegalArgumentException("Report start date cannot be after end date.");
        return new ReportFilters(from, to, module == null || module.isBlank() ? null : module.trim());
    }
}
