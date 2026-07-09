package com.kravia.companyos.meeting;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/board-meetings")
public class BoardMeetingController {
    private final BoardMeetingService service;

    public BoardMeetingController(BoardMeetingService service) { this.service = service; }

    @PostMapping
    public BoardMeetingResponse create(@Valid @RequestBody BoardMeetingRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @GetMapping
    public List<BoardMeetingResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) MeetingType meetingType,
        @RequestParam(required = false) MeetingStatus status,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(query, meetingType, status, actor);
    }

    @GetMapping("/{id}")
    public BoardMeetingResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PutMapping("/{id}")
    public BoardMeetingResponse update(@PathVariable UUID id, @Valid @RequestBody BoardMeetingRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }

    @PostMapping("/{id}/action-items")
    public MeetingActionItemResponse addActionItem(
        @PathVariable UUID id,
        @Valid @RequestBody MeetingActionItemRequest request,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.addActionItem(id, request, actor);
    }

    @PutMapping("/{id}/action-items/{actionItemId}")
    public MeetingActionItemResponse updateActionItem(
        @PathVariable UUID id,
        @PathVariable UUID actionItemId,
        @Valid @RequestBody MeetingActionItemRequest request,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.updateActionItem(id, actionItemId, request, actor);
    }
}
