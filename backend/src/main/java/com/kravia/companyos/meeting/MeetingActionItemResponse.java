package com.kravia.companyos.meeting;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MeetingActionItemResponse(
    UUID id,
    String actionText,
    String owner,
    LocalDate dueDate,
    MeetingActionItemStatus status,
    Instant createdAt,
    Instant updatedAt
) {
    public static MeetingActionItemResponse from(MeetingActionItem item) {
        return new MeetingActionItemResponse(
            item.getId(),
            item.getActionText(),
            item.getOwner(),
            item.getDueDate(),
            item.getStatus(),
            item.getCreatedAt(),
            item.getUpdatedAt()
        );
    }
}
