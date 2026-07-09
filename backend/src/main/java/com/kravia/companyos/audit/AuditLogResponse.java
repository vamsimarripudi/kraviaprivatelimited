package com.kravia.companyos.audit;

import java.time.Instant;
import java.util.UUID;

public record AuditLogResponse(UUID id, String actorEmail, String actorName, String actorRole, String module, String action, String description, String severity, Instant createdAt) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(log.getId(), log.getActorEmail(), log.getActorName(), log.getActorRole(), log.getModule().name(), log.getAction(), log.getDescription(), log.getSeverity(), log.getCreatedAt());
    }
}
