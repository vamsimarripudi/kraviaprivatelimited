package com.kravia.companyos.platform;

import java.time.Instant;
import java.util.UUID;

public record WorkflowHistoryResponse(UUID id, String actor, String fromState, String toState, String note, Instant createdAt) {
    public static WorkflowHistoryResponse from(WorkflowHistory history) {
        return new WorkflowHistoryResponse(history.getId(), history.getActor(), history.getFromState(), history.getToState(), history.getNote(), history.getCreatedAt());
    }
}
