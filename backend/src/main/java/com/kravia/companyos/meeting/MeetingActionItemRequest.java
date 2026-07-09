package com.kravia.companyos.meeting;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record MeetingActionItemRequest(
    @NotBlank @Size(max = 3000) String actionText,
    @NotBlank @Size(max = 255) String owner,
    LocalDate dueDate,
    @NotNull MeetingActionItemStatus status
) {}
