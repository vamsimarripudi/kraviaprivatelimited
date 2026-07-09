package com.kravia.companyos.platform;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowService {
    private static final String MODULE = "ERP_WORKFLOWS";

    private final WorkflowInstanceRepository workflows;
    private final WorkflowCommentRepository comments;
    private final WorkflowHistoryRepository history;
    private final PermissionService permissions;
    private final AuditService auditService;

    public WorkflowService(
        WorkflowInstanceRepository workflows,
        WorkflowCommentRepository comments,
        WorkflowHistoryRepository history,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.workflows = workflows;
        this.comments = comments;
        this.history = history;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<WorkflowResponse> list(String query, WorkflowType workflowType, WorkflowState state, String assignee, AppUser actor) {
        requireViewer(actor);
        return workflows.search(normalize(query), workflowType, state, normalize(assignee)).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public WorkflowResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return toResponse(find(id));
    }

    @Transactional
    public WorkflowResponse create(WorkflowRequest request, AppUser actor) {
        requireEditor(actor);
        WorkflowInstance workflow = new WorkflowInstance();
        workflow.setWorkflowType(request.workflowType());
        workflow.setTitle(request.title().trim());
        workflow.setState(request.state() == null ? WorkflowState.DRAFT : request.state());
        workflow.setAssignee(blankToNull(request.assignee()));
        workflow.setRelatedModule(normalizeModule(request.relatedModule()));
        workflow.setRelatedRecordId(request.relatedRecordId());
        workflow.setCreatedBy(actor.getDisplayName());
        WorkflowInstance saved = workflows.saveAndFlush(workflow);
        addHistory(saved, actor, null, saved.getState(), "Workflow created.");
        auditService.record(actor, MODULE, "WORKFLOW_CREATED", "Created workflow " + saved.getTitle(), "IMPORTANT");
        return toResponse(saved);
    }

    @Transactional
    public WorkflowResponse updateState(UUID id, WorkflowStateRequest request, AppUser actor) {
        requireEditor(actor);
        WorkflowInstance workflow = find(id);
        ensureEditable(workflow);
        WorkflowState previous = workflow.getState();
        workflow.setState(request.state());
        if (request.state() == WorkflowState.ARCHIVED) workflow.setArchivedAt(Instant.now());
        WorkflowInstance saved = workflows.saveAndFlush(workflow);
        addHistory(saved, actor, previous, saved.getState(), blankToNull(request.note()));
        auditService.record(actor, MODULE, "WORKFLOW_STATE_CHANGED", "Changed workflow state from " + previous + " to " + saved.getState(), "IMPORTANT");
        return toResponse(saved);
    }

    @Transactional
    public WorkflowResponse addComment(UUID id, WorkflowCommentRequest request, AppUser actor) {
        requireEditor(actor);
        WorkflowInstance workflow = find(id);
        ensureEditable(workflow);
        WorkflowComment comment = new WorkflowComment();
        comment.setWorkflowId(workflow.getId());
        comment.setAuthor(actor.getDisplayName());
        comment.setCommentText(request.comment().trim());
        comments.save(comment);
        auditService.record(actor, MODULE, "WORKFLOW_COMMENT_ADDED", "Added workflow comment for " + workflow.getTitle(), "INFO");
        return toResponse(workflow);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        WorkflowInstance workflow = find(id);
        WorkflowState previous = workflow.getState();
        workflow.setState(WorkflowState.ARCHIVED);
        workflow.setArchivedAt(Instant.now());
        workflows.save(workflow);
        addHistory(workflow, actor, previous, WorkflowState.ARCHIVED, "Workflow archived.");
        auditService.record(actor, MODULE, "WORKFLOW_ARCHIVED", "Archived workflow " + workflow.getTitle(), "WARNING");
    }

    private WorkflowResponse toResponse(WorkflowInstance workflow) {
        return WorkflowResponse.from(workflow, comments.findByWorkflowIdOrderByCreatedAtAsc(workflow.getId()), history.findByWorkflowIdOrderByCreatedAtAsc(workflow.getId()));
    }

    private void addHistory(WorkflowInstance workflow, AppUser actor, WorkflowState fromState, WorkflowState toState, String note) {
        WorkflowHistory record = new WorkflowHistory();
        record.setWorkflowId(workflow.getId());
        record.setActor(actor.getDisplayName());
        record.setFromState(fromState == null ? null : fromState.name());
        record.setToState(toState.name());
        record.setNote(note);
        history.save(record);
    }

    private WorkflowInstance find(UUID id) {
        return workflows.findById(id).orElseThrow(() -> new NotFoundException("Workflow not found."));
    }

    private void ensureEditable(WorkflowInstance workflow) {
        if (workflow.getArchivedAt() != null || workflow.getState() == WorkflowState.ARCHIVED) throw new ForbiddenOperationException("Archived workflows cannot be changed.");
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String normalizeModule(String value) { return value == null || value.isBlank() ? null : value.trim().toUpperCase(); }
}
