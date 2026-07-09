package com.kravia.companyos.meeting;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.ModuleType;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.user.AppUser;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class BoardMeetingService {
    private final BoardMeetingRepository repository;
    private final AuditService auditService;

    public BoardMeetingService(BoardMeetingRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
    }

    public List<BoardMeetingResponse> list() { return repository.findAll().stream().map(BoardMeetingResponse::from).toList(); }

    public BoardMeetingResponse get(UUID id) { return BoardMeetingResponse.from(repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."))); }

    @Transactional
    public BoardMeetingResponse save(BoardMeetingRequest request, AppUser actor) {
        ensureWrite(actor);
        BoardMeeting record = new BoardMeeting();
        apply(record, request);
        BoardMeeting saved = repository.save(record);
        auditService.record(actor, ModuleType.BOARD_MEETING, "CREATED", "Created record " + saved.getTitle(), "IMPORTANT");
        return BoardMeetingResponse.from(saved);
    }

    @Transactional
    public BoardMeetingResponse update(UUID id, BoardMeetingRequest request, AppUser actor) {
        ensureWrite(actor);
        BoardMeeting record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        apply(record, request);
        BoardMeeting saved = repository.save(record);
        auditService.record(actor, ModuleType.BOARD_MEETING, "UPDATED", "Updated record " + saved.getTitle(), "IMPORTANT");
        return BoardMeetingResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        if (actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can archive records.");
        BoardMeeting record = repository.findById(id).orElseThrow(() -> new NotFoundException("Record not found."));
        record.setArchived(true);
        record.setStatus("ARCHIVED");
        auditService.record(actor, ModuleType.BOARD_MEETING, "ARCHIVED", "Archived record " + record.getTitle(), "WARNING");
    }

    private void apply(BoardMeeting record, BoardMeetingRequest request) {
        record.setTitle(request.title());
        record.setStatus(request.status());
        record.setOwnerName(request.ownerName());
        record.setDueDate(request.dueDate());
        record.setCategory(request.category());
        record.setReferenceCode(request.referenceCode());
        record.setAmount(request.amount());
        record.setDetails(request.details());
        record.setNotes(request.notes());
    }

    private void ensureWrite(AppUser actor) {
        if (actor.getRole() == Role.VIEWER) throw new ForbiddenOperationException("Viewer role is read-only.");
        if (false && actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException("Only founders can modify this module.");
    }
}
