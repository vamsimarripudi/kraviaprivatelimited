package com.kravia.companyos.audit;

import java.util.Comparator;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/audit-logs")
public class AuditLogController {
    private final AuditLogRepository repository;

    public AuditLogController(AuditLogRepository repository) { this.repository = repository; }

    @GetMapping
    @PreAuthorize("hasAnyRole('FOUNDER','DIRECTOR')")
    public List<AuditLogResponse> list() {
        return repository.findAll().stream()
            .sorted(Comparator.comparing(AuditLog::getCreatedAt).reversed())
            .map(AuditLogResponse::from)
            .toList();
    }
}

