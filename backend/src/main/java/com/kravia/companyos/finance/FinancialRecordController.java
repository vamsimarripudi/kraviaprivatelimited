package com.kravia.companyos.finance;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/financial-records")
public class FinancialRecordController {
    private final FinancialRecordService service;

    public FinancialRecordController(FinancialRecordService service) { this.service = service; }

    @PostMapping
    public FinancialRecordResponse create(@Valid @RequestBody FinancialRecordRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @GetMapping
    public List<FinancialRecordResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) Integer reportingYear,
        @RequestParam(required = false) Integer reportingMonth,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(query, reportingYear, reportingMonth, actor);
    }

    @GetMapping("/{id}")
    public FinancialRecordResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PutMapping("/{id}")
    public FinancialRecordResponse update(@PathVariable UUID id, @Valid @RequestBody FinancialRecordRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}
