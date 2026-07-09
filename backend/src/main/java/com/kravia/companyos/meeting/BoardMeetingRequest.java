package com.kravia.companyos.meeting;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;
import java.util.List;

public record BoardMeetingRequest(
    @NotBlank @Size(max = 255) String title,
    @NotNull LocalDateTime meetingDate,
    @NotNull MeetingType meetingType,
    @NotNull MeetingStatus status,
    List<@Size(max = 2000) String> agendaItems,
    @Size(max = 6000) String discussionNotes,
    List<@Size(max = 3000) String> decisions,
    List<@Size(max = 4000) String> resolutions,
    @Valid List<MeetingActionItemRequest> actionItems
) {}
