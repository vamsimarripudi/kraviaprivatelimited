package com.kravia.companyos.meeting;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record BoardMeetingResponse(
    UUID id,
    String title,
    LocalDateTime meetingDate,
    MeetingType meetingType,
    MeetingStatus status,
    List<String> agendaItems,
    String discussionNotes,
    List<String> decisions,
    List<String> resolutions,
    List<MeetingActionItemResponse> actionItems,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt
) {
    public static BoardMeetingResponse from(BoardMeeting meeting) {
        return new BoardMeetingResponse(
            meeting.getId(),
            meeting.getTitle(),
            meeting.getMeetingDate(),
            meeting.getMeetingType(),
            meeting.getStatus(),
            meeting.getAgendaItems().stream().map(MeetingAgendaItem::getItemText).toList(),
            meeting.getDiscussionNotes(),
            meeting.getDecisions().stream().map(MeetingDecision::getDecisionText).toList(),
            meeting.getResolutions().stream().map(MeetingResolution::getResolutionText).toList(),
            meeting.getActionItems().stream().map(MeetingActionItemResponse::from).toList(),
            meeting.getCreatedBy(),
            meeting.getCreatedAt(),
            meeting.getUpdatedAt(),
            meeting.getArchivedAt()
        );
    }
}
