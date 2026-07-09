package com.kravia.companyos.task;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompanyTaskService {
    private static final String MODULE = "COMPANY_TASKS";
    private static final Set<TaskStatus> ACTIVE_STATUSES = Set.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.WAITING, TaskStatus.BLOCKED);
    private static final Set<TaskPriority> DATED_PRIORITIES = Set.of(TaskPriority.HIGH, TaskPriority.CRITICAL);

    private final CompanyTaskRepository tasks;
    private final PermissionService permissions;
    private final AuditService auditService;

    public CompanyTaskService(CompanyTaskRepository tasks, PermissionService permissions, AuditService auditService) {
        this.tasks = tasks;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<CompanyTaskResponse> list(String query, TaskCategory category, String assignee, TaskStatus status, TaskPriority priority, AppUser actor) {
        requireViewer(actor);
        return tasks.search(normalize(query), category, normalize(assignee), status, priority).stream().map(CompanyTaskResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public CompanyTaskResponse get(UUID id, AppUser actor) {
        requireViewer(actor);
        return CompanyTaskResponse.from(find(id));
    }

    @Transactional
    public CompanyTaskResponse create(CompanyTaskRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        CompanyTask task = new CompanyTask();
        task.setCreatedBy(actor.getDisplayName());
        apply(task, request);
        applyCompletionState(task);
        CompanyTask saved = tasks.saveAndFlush(task);
        auditService.record(actor, MODULE, "TASK_CREATED", "Created task " + saved.getTitle(), "IMPORTANT");
        return CompanyTaskResponse.from(saved);
    }

    @Transactional
    public CompanyTaskResponse update(UUID id, CompanyTaskRequest request, AppUser actor) {
        requireEditor(actor);
        validateRequest(request);
        CompanyTask task = find(id);
        ensureEditable(task);
        TaskStatus previousStatus = task.getStatus();
        if (request.status() == TaskStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        apply(task, request);
        applyCompletionState(task);
        if (task.getStatus() == TaskStatus.ARCHIVED) task.setArchivedAt(Instant.now());
        CompanyTask saved = tasks.saveAndFlush(task);
        auditService.record(actor, MODULE, "TASK_UPDATED", "Updated task " + saved.getTitle(), "IMPORTANT");
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        if (previousStatus != TaskStatus.DONE && saved.getStatus() == TaskStatus.DONE) auditDone(actor, saved);
        return CompanyTaskResponse.from(saved);
    }

    @Transactional
    public CompanyTaskResponse updateStatus(UUID id, TaskStatusRequest request, AppUser actor) {
        requireEditor(actor);
        if (request.status() == null) throw new IllegalArgumentException("Task status is required.");
        CompanyTask task = find(id);
        ensureEditable(task);
        if (request.status() == TaskStatus.ARCHIVED) permissions.requireAnyRole(actor, Role.FOUNDER);
        TaskStatus previousStatus = task.getStatus();
        task.setStatus(request.status());
        validateTaskState(task);
        applyCompletionState(task);
        if (task.getStatus() == TaskStatus.ARCHIVED) task.setArchivedAt(Instant.now());
        CompanyTask saved = tasks.saveAndFlush(task);
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        if (previousStatus != TaskStatus.DONE && saved.getStatus() == TaskStatus.DONE) auditDone(actor, saved);
        return CompanyTaskResponse.from(saved);
    }

    @Transactional
    public CompanyTaskResponse complete(UUID id, AppUser actor) {
        requireEditor(actor);
        CompanyTask task = find(id);
        ensureEditable(task);
        TaskStatus previousStatus = task.getStatus();
        task.setStatus(TaskStatus.DONE);
        applyCompletionState(task);
        CompanyTask saved = tasks.saveAndFlush(task);
        auditStatusChange(actor, saved, previousStatus, saved.getStatus());
        auditDone(actor, saved);
        return CompanyTaskResponse.from(saved);
    }

    @Transactional
    public void archive(UUID id, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        CompanyTask task = find(id);
        TaskStatus previousStatus = task.getStatus();
        if (task.getStatus() != TaskStatus.ARCHIVED) {
            task.setStatus(TaskStatus.ARCHIVED);
            task.setArchivedAt(Instant.now());
        }
        auditStatusChange(actor, task, previousStatus, task.getStatus());
        auditService.record(actor, MODULE, "TASK_ARCHIVED", "Archived task " + task.getTitle(), "WARNING");
    }

    private void apply(CompanyTask task, CompanyTaskRequest request) {
        task.setTitle(request.title().trim());
        task.setCategory(request.category());
        task.setDescription(blankToNull(request.description()));
        task.setAssignedTo(blankToNull(request.assignedTo()));
        task.setDueDate(request.dueDate());
        task.setPriority(request.priority());
        task.setStatus(request.status());
        task.setRelatedSection(blankToNull(request.relatedSection()));
        task.setRelatedDocumentId(request.relatedDocumentId());
        task.setNotes(blankToNull(request.notes()));
    }

    private void validateRequest(CompanyTaskRequest request) {
        if (request.title() == null || request.title().isBlank()) throw new IllegalArgumentException("Task title is required.");
        if (request.category() == null) throw new IllegalArgumentException("Task category is required.");
        if (request.status() == null) throw new IllegalArgumentException("Task status is required.");
        if (request.priority() == null) throw new IllegalArgumentException("Task priority is required.");
        if (ACTIVE_STATUSES.contains(request.status()) && (request.assignedTo() == null || request.assignedTo().isBlank())) throw new IllegalArgumentException("Assigned person is required when task is active.");
        if (DATED_PRIORITIES.contains(request.priority()) && request.dueDate() == null) throw new IllegalArgumentException("Due date is required for high or critical priority tasks.");
    }

    private void validateTaskState(CompanyTask task) {
        if (ACTIVE_STATUSES.contains(task.getStatus()) && (task.getAssignedTo() == null || task.getAssignedTo().isBlank())) throw new IllegalArgumentException("Assigned person is required when task is active.");
        if (DATED_PRIORITIES.contains(task.getPriority()) && task.getDueDate() == null) throw new IllegalArgumentException("Due date is required for high or critical priority tasks.");
    }

    private void applyCompletionState(CompanyTask task) {
        if (task.getStatus() == TaskStatus.DONE && task.getCompletedAt() == null) task.setCompletedAt(Instant.now());
        if (task.getStatus() != TaskStatus.DONE) task.setCompletedAt(null);
    }

    private void ensureEditable(CompanyTask task) {
        if (task.getStatus() == TaskStatus.ARCHIVED) throw new ForbiddenOperationException("Archived tasks cannot be edited.");
    }

    private CompanyTask find(UUID id) {
        return tasks.findById(id).orElseThrow(() -> new NotFoundException("Task not found."));
    }

    private void auditStatusChange(AppUser actor, CompanyTask task, TaskStatus previousStatus, TaskStatus newStatus) {
        if (previousStatus != newStatus) auditService.record(actor, MODULE, "TASK_STATUS_CHANGED", "Changed task status from " + previousStatus + " to " + newStatus + " for " + task.getTitle(), "INFO");
    }

    private void auditDone(AppUser actor, CompanyTask task) {
        auditService.record(actor, MODULE, "TASK_COMPLETED", "Marked task done " + task.getTitle(), "IMPORTANT");
    }

    private void requireEditor(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}