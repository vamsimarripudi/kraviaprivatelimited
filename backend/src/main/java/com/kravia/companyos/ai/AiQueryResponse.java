package com.kravia.companyos.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record AiQueryResponse(
    UUID id,
    String query,
    @JsonProperty("module_context") AiModuleContext moduleContext,
    @JsonProperty("output_type") AiOutputType outputType,
    @JsonProperty("date_range") AiDateRange dateRange,
    String response,
    String createdBy,
    String actorEmail,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt,
    List<AiContextSnapshotResponse> contextSnapshots
) {
    public static AiQueryResponse from(AiQuery query) {
        return new AiQueryResponse(
            query.getId(),
            query.getQuery(),
            query.getModuleContext(),
            query.getOutputType(),
            new AiDateRange(query.getDateFrom(), query.getDateTo()),
            query.getResponse(),
            query.getCreatedBy(),
            query.getActorEmail(),
            query.getCreatedAt(),
            query.getUpdatedAt(),
            query.getArchivedAt(),
            query.getContextSnapshots().stream().map(AiContextSnapshotResponse::from).toList()
        );
    }
}
