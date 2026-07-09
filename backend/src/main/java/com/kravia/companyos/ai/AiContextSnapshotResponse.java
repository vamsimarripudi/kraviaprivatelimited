package com.kravia.companyos.ai;

import java.time.Instant;
import java.util.UUID;

public record AiContextSnapshotResponse(UUID id, String moduleContext, String snapshotText, Instant createdAt) {
    public static AiContextSnapshotResponse from(AiContextSnapshot snapshot) {
        return new AiContextSnapshotResponse(snapshot.getId(), snapshot.getModuleContext(), snapshot.getSnapshotText(), snapshot.getCreatedAt());
    }
}
