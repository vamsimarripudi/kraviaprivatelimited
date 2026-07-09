package com.kravia.companyos.audit;

import com.kravia.companyos.user.AppUser;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class AuditService {
    private final AuditLogRepository repository;

    public AuditService(AuditLogRepository repository) { this.repository = repository; }

    @Transactional
    public void record(AppUser actor, String module, String action, String description, String severity) {
        if (actor == null) return;
        AuditLog log = new AuditLog();
        log.setActorEmail(actor.getEmail());
        log.setActorName(actor.getDisplayName());
        log.setActorRoles(actor.roleSummary());
        log.setModule(module);
        log.setAction(action);
        log.setDescription(description);
        log.setSeverity(severity == null || severity.isBlank() ? "INFO" : severity);
        repository.save(log);
    }
}
