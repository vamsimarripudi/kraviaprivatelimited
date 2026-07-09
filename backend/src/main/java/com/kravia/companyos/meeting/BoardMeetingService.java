package com.kravia.companyos.meeting;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BoardMeetingService {
    private static final String MODULE = "BOARD_MEETINGS";

    private final BoardMeetingRepository meetings;
    private final MeetingActionItemRepository actionItems;
    private final PermissionService permissions;
    private final AuditService auditService;

    public BoardMeetingService(
        BoardMeetingRepository meetings,
        MeetingActionItemRepository actionItems,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.meetings = meetings;
        this.actionItems = actionItems;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<BoardMeetingResponse> list(String query, MeetingType meetingType, MeetingStatus status, AppUser actor) {
        requireViewer(actor);
        return meetings.search(normalizeQuery(query), meetingType, status).stream().map(BoardMeetingResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public BoardMeetingResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return BoardMeetingResponse.from(find(id));
    }

    @Transactional
    public BoardMeetingResponse create(BoardMeetingRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request, null);

        BoardMeeting meeting = new BoardMeeting();
        meeting.setCreatedBy(actor.getDisplayName());
        applyMeetingFields(meeting, request, true);
        BoardMeeting saved = meetings.saveAndFlush(meeting);
        auditService.record(actor, MODULE, "MEETING_CREATED", "Created meeting " + saved.getTitle(), "IMPORTANT");
        return BoardMeetingResponse.from(saved);
    }

    @Transactional
    public BoardMeetingResponse update(UUID id, BoardMeetingRequest request, AppUser actor) {
        requireEditor(actor);
        BoardMeeting meeting = find(id);
        ensureEditable(meeting);
        validateRequest(request, meeting);

        MeetingStatus previousStatus = meeting.getStatus();
        if (request.status() == MeetingStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        applyMeetingFields(meeting, request, request.actionItems() != null);
        if (meeting.getStatus() == MeetingStatus.ARCHIVED) meeting.setArchivedAt(Instant.now());
        BoardMeeting saved = meetings.saveAndFlush(meeting);
        auditService.record(actor, MODULE, "MEETING_UPDATED", "Updated meeting " + saved.getTitle(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        return BoardMeetingResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        BoardMeeting meeting = find(id);
        MeetingStatus previousStatus = meeting.getStatus();
        if (meeting.getStatus() != MeetingStatus.ARCHIVED) {
            meeting.setStatus(MeetingStatus.ARCHIVED);
            meeting.setArchivedAt(Instant.now());
        }
        auditStatusChange(actor, meeting, previousStatus, meeting.getStatus());
        auditService.record(actor, MODULE, "MEETING_ARCHIVED", "Archived meeting " + meeting.getTitle(), "WARNING");
    }

    @Transactional
    public MeetingActionItemResponse addActionItem(UUID meetingId, MeetingActionItemRequest request, AppUser actor) {
        requireEditor(actor);
        BoardMeeting meeting = find(meetingId);
        ensureEditable(meeting);
        validateActionItem(request);

        MeetingActionItem item = actionItemFrom(request, meeting, meeting.getActionItems().size() + 1);
        meeting.getActionItems().add(item);
        BoardMeeting saved = meetings.saveAndFlush(meeting);
        MeetingActionItem savedItem = saved.getActionItems().get(saved.getActionItems().size() - 1);
        auditService.record(actor, MODULE, "MEETING_ACTION_ITEM_CREATED", "Added action item to meeting " + saved.getTitle(), "IMPORTANT");
        return MeetingActionItemResponse.from(savedItem);
    }

    @Transactional
    public MeetingActionItemResponse updateActionItem(UUID meetingId, UUID actionItemId, MeetingActionItemRequest request, AppUser actor) {
        requireEditor(actor);
        BoardMeeting meeting = find(meetingId);
        ensureEditable(meeting);
        validateActionItem(request);

        MeetingActionItem item = actionItems.findById(actionItemId).orElseThrow(() -> new NotFoundException("Action item not found."));
        if (!Objects.equals(item.getMeeting().getId(), meeting.getId())) throw new NotFoundException("Action item not found.");
        MeetingActionItemStatus previousStatus = item.getStatus();
        applyActionItem(item, request);
        MeetingActionItem saved = actionItems.saveAndFlush(item);
        auditService.record(actor, MODULE, "MEETING_ACTION_ITEM_UPDATED", "Updated action item for meeting " + meeting.getTitle(), "IMPORTANT");
        if (previousStatus != saved.getStatus()) {
            auditService.record(actor, MODULE, "MEETING_ACTION_STATUS_CHANGED", "Changed action item status from " + previousStatus + " to " + saved.getStatus(), "INFO");
        }
        return MeetingActionItemResponse.from(saved);
    }

    private void applyMeetingFields(BoardMeeting meeting, BoardMeetingRequest request, boolean replaceActionItems) {
        meeting.setTitle(request.title().trim());
        meeting.setMeetingDate(request.meetingDate());
        meeting.setMeetingType(request.meetingType());
        meeting.setStatus(request.status());
        meeting.setDiscussionNotes(blankToNull(request.discussionNotes()));
        replaceAgendaItems(meeting, normalizeTextList(request.agendaItems()));
        replaceDecisions(meeting, normalizeTextList(request.decisions()));
        replaceResolutions(meeting, normalizeTextList(request.resolutions()));
        if (replaceActionItems) replaceActionItems(meeting, request.actionItems() == null ? List.of() : request.actionItems());
    }

    private void replaceAgendaItems(BoardMeeting meeting, List<String> values) {
        meeting.getAgendaItems().clear();
        for (int index = 0; index < values.size(); index++) {
            MeetingAgendaItem item = new MeetingAgendaItem();
            item.setMeeting(meeting);
            item.setSortOrder(index + 1);
            item.setItemText(values.get(index));
            meeting.getAgendaItems().add(item);
        }
    }

    private void replaceDecisions(BoardMeeting meeting, List<String> values) {
        meeting.getDecisions().clear();
        for (int index = 0; index < values.size(); index++) {
            MeetingDecision decision = new MeetingDecision();
            decision.setMeeting(meeting);
            decision.setSortOrder(index + 1);
            decision.setDecisionText(values.get(index));
            meeting.getDecisions().add(decision);
        }
    }

    private void replaceResolutions(BoardMeeting meeting, List<String> values) {
        meeting.getResolutions().clear();
        for (int index = 0; index < values.size(); index++) {
            MeetingResolution resolution = new MeetingResolution();
            resolution.setMeeting(meeting);
            resolution.setSortOrder(index + 1);
            resolution.setResolutionText(values.get(index));
            meeting.getResolutions().add(resolution);
        }
    }

    private void replaceActionItems(BoardMeeting meeting, List<MeetingActionItemRequest> values) {
        meeting.getActionItems().clear();
        for (int index = 0; index < values.size(); index++) {
            meeting.getActionItems().add(actionItemFrom(values.get(index), meeting, index + 1));
        }
    }

    private MeetingActionItem actionItemFrom(MeetingActionItemRequest request, BoardMeeting meeting, int sortOrder) {
        MeetingActionItem item = new MeetingActionItem();
        item.setMeeting(meeting);
        item.setSortOrder(sortOrder);
        applyActionItem(item, request);
        return item;
    }

    private void applyActionItem(MeetingActionItem item, MeetingActionItemRequest request) {
        item.setActionText(request.actionText().trim());
        item.setOwner(request.owner().trim());
        item.setDueDate(request.dueDate());
        item.setStatus(request.status());
    }

    private void validateRequest(BoardMeetingRequest request, BoardMeeting existing) {
        if (request.title() == null || request.title().isBlank()) throw new IllegalArgumentException("Meeting title is required.");
        if (request.meetingDate() == null) throw new IllegalArgumentException("Meeting date is required.");
        if (request.meetingType() == null) throw new IllegalArgumentException("Meeting type is required.");
        if (request.status() == null) throw new IllegalArgumentException("Meeting status is required.");

        List<String> agenda = request.agendaItems() == null && existing != null
            ? existing.getAgendaItems().stream().map(MeetingAgendaItem::getItemText).toList()
            : normalizeTextList(request.agendaItems());
        if (request.status() == MeetingStatus.COMPLETED && agenda.isEmpty()) {
            throw new IllegalArgumentException("At least one agenda item is required before marking a meeting completed.");
        }
        if (request.actionItems() != null) request.actionItems().forEach(this::validateActionItem);
    }

    private void validateActionItem(MeetingActionItemRequest request) {
        if (request == null) throw new IllegalArgumentException("Action item is required.");
        if (request.actionText() == null || request.actionText().isBlank()) throw new IllegalArgumentException("Action item title is required.");
        if (request.owner() == null || request.owner().isBlank()) throw new IllegalArgumentException("Action item owner is required.");
        if (request.status() == null) throw new IllegalArgumentException("Action item status is required.");
        if (request.status() != MeetingActionItemStatus.DONE && request.dueDate() == null) {
            throw new IllegalArgumentException("Due date is required for active action items.");
        }
    }

    private void ensureEditable(BoardMeeting meeting) {
        if (meeting.getStatus() == MeetingStatus.ARCHIVED) throw new ForbiddenOperationException("Archived meetings cannot be edited.");
    }

    private void auditStatusChange(AppUser actor, BoardMeeting meeting, MeetingStatus previousStatus, MeetingStatus newStatus) {
        if (previousStatus != newStatus) {
            auditService.record(actor, MODULE, "MEETING_STATUS_CHANGED", "Changed meeting status from " + previousStatus + " to " + newStatus + " for " + meeting.getTitle(), "INFO");
        }
    }

    private BoardMeeting find(UUID id) {
        return meetings.findById(id).orElseThrow(() -> new NotFoundException("Board meeting not found."));
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalizeQuery(String query) { return query == null ? null : query.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private List<String> normalizeTextList(List<String> values) {
        if (values == null) return List.of();
        return values.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(value -> !value.isBlank())
            .toList();
    }
}

