package com.kravia.companyos.platform;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.platform.WorkflowAutomationDto.ActionRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.ActionResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.ConditionRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.ConditionResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.ExecutionCommandRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.InstanceStepStatusRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.RuleRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.RuleResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.ScheduledJobRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.ScheduledJobResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.StartWorkflowRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.StepRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.StepResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.TemplateRequest;
import com.kravia.companyos.platform.WorkflowAutomationDto.TemplateResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.WorkflowEngineSummary;
import com.kravia.companyos.platform.WorkflowAutomationDto.WorkflowInstanceDetailResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.WorkflowMetric;
import com.kravia.companyos.platform.WorkflowAutomationDto.WorkflowNotificationResponse;
import com.kravia.companyos.platform.WorkflowAutomationDto.WorkflowReportResponse;
import com.kravia.companyos.platform.WorkflowAutomationEnums.ScheduledJobStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowExecutionCommand;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowNotificationStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowReportType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowRuleStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowStepStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowTemplateStatus;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowAutomationService {
    private static final String MODULE = "WORKFLOW_ENGINE";

    private final WorkflowTemplateRepository templates;
    private final WorkflowTemplateStepRepository templateSteps;
    private final WorkflowInstanceRepository workflows;
    private final WorkflowInstanceStepRepository instanceSteps;
    private final WorkflowActionRepository actions;
    private final WorkflowConditionRepository conditions;
    private final WorkflowRuleRepository rules;
    private final WorkflowNotificationRepository workflowNotifications;
    private final ScheduledJobRepository scheduledJobs;
    private final WorkflowHistoryRepository history;
    private final PermissionService permissions;
    private final AuditService auditService;

    public WorkflowAutomationService(
        WorkflowTemplateRepository templates,
        WorkflowTemplateStepRepository templateSteps,
        WorkflowInstanceRepository workflows,
        WorkflowInstanceStepRepository instanceSteps,
        WorkflowActionRepository actions,
        WorkflowConditionRepository conditions,
        WorkflowRuleRepository rules,
        WorkflowNotificationRepository workflowNotifications,
        ScheduledJobRepository scheduledJobs,
        WorkflowHistoryRepository history,
        PermissionService permissions,
        AuditService auditService
    ) {
        this.templates = templates;
        this.templateSteps = templateSteps;
        this.workflows = workflows;
        this.instanceSteps = instanceSteps;
        this.actions = actions;
        this.conditions = conditions;
        this.rules = rules;
        this.workflowNotifications = workflowNotifications;
        this.scheduledJobs = scheduledJobs;
        this.history = history;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public WorkflowEngineSummary summary(AppUser actor) {
        requireViewer(actor);
        List<WorkflowInstance> activeWorkflows = activeWorkflows();
        long running = countWorkflows(activeWorkflows, WorkflowState.RUNNING);
        long paused = countWorkflows(activeWorkflows, WorkflowState.PAUSED);
        long completed = countWorkflows(activeWorkflows, WorkflowState.COMPLETED);
        long failed = countWorkflows(activeWorkflows, WorkflowState.FAILED);
        long escalated = countWorkflows(activeWorkflows, WorkflowState.ESCALATED);
        List<String> emptyStates = activeWorkflows.isEmpty() && templates.count() == 0
            ? List.of("No workflow records have been added yet.")
            : List.of();
        return new WorkflowEngineSummary(
            templates.search(null, null, null).size(),
            templates.countByStatusAndArchivedAtIsNull(WorkflowTemplateStatus.ACTIVE),
            running,
            paused,
            completed,
            failed,
            escalated,
            actions.countByStatusAndArchivedAtIsNull(WorkflowActionStatus.PENDING),
            rules.countByStatusAndArchivedAtIsNull(WorkflowRuleStatus.ACTIVE),
            scheduledJobs.countByStatusAndArchivedAtIsNull(ScheduledJobStatus.ACTIVE),
            averageCompletionTime(activeWorkflows),
            List.of(
                metric("Running workflows", running, "neutral"),
                metric("Paused workflows", paused, "warning"),
                metric("Completed workflows", completed, "positive"),
                metric("Failed workflows", failed, "negative"),
                metric("Escalated workflows", escalated, "warning")
            ),
            emptyStates
        );
    }

    @Transactional(readOnly = true)
    public List<TemplateResponse> templates(String query, WorkflowTemplateStatus status, WorkflowType workflowType, AppUser actor) {
        requireViewer(actor);
        return templates.search(normalize(query), status, workflowType).stream().map(this::templateResponse).toList();
    }

    @Transactional
    public TemplateResponse createTemplate(TemplateRequest request, AppUser actor) {
        requireFounder(actor);
        WorkflowTemplate template = new WorkflowTemplate();
        apply(template, request);
        template.setCreatedBy(actor.getDisplayName());
        WorkflowTemplate saved = templates.saveAndFlush(template);
        auditService.record(actor, MODULE, "WORKFLOW_TEMPLATE_CREATED", "Created workflow template " + saved.getTemplateName(), "IMPORTANT");
        return templateResponse(saved);
    }

    @Transactional
    public TemplateResponse updateTemplate(UUID id, TemplateRequest request, AppUser actor) {
        requireFounder(actor);
        WorkflowTemplate template = findTemplate(id);
        ensureNotArchived(template.getArchivedAt(), "Archived templates cannot be changed.");
        apply(template, request);
        WorkflowTemplate saved = templates.saveAndFlush(template);
        auditService.record(actor, MODULE, "WORKFLOW_TEMPLATE_UPDATED", "Updated workflow template " + saved.getTemplateName(), "IMPORTANT");
        return templateResponse(saved);
    }

    @Transactional
    public void archiveTemplate(UUID id, AppUser actor) {
        requireFounder(actor);
        WorkflowTemplate template = findTemplate(id);
        template.setStatus(WorkflowTemplateStatus.ARCHIVED);
        template.setArchivedAt(Instant.now());
        templates.save(template);
        auditService.record(actor, MODULE, "WORKFLOW_TEMPLATE_ARCHIVED", "Archived workflow template " + template.getTemplateName(), "WARNING");
    }

    @Transactional
    public StepResponse addStep(UUID templateId, StepRequest request, AppUser actor) {
        requireFounder(actor);
        WorkflowTemplate template = findTemplate(templateId);
        ensureNotArchived(template.getArchivedAt(), "Archived templates cannot be changed.");
        WorkflowTemplateStep step = new WorkflowTemplateStep();
        step.setTemplateId(template.getId());
        apply(step, request);
        WorkflowTemplateStep saved = templateSteps.saveAndFlush(step);
        auditService.record(actor, MODULE, "WORKFLOW_STEP_CREATED", "Created workflow step " + saved.getStepName(), "INFO");
        return StepResponse.from(saved);
    }

    @Transactional
    public StepResponse updateStep(UUID stepId, StepRequest request, AppUser actor) {
        requireFounder(actor);
        WorkflowTemplateStep step = findTemplateStep(stepId);
        ensureNotArchived(step.getArchivedAt(), "Archived workflow steps cannot be changed.");
        apply(step, request);
        WorkflowTemplateStep saved = templateSteps.saveAndFlush(step);
        auditService.record(actor, MODULE, "WORKFLOW_STEP_UPDATED", "Updated workflow step " + saved.getStepName(), "INFO");
        return StepResponse.from(saved);
    }

    @Transactional
    public void archiveStep(UUID stepId, AppUser actor) {
        requireFounder(actor);
        WorkflowTemplateStep step = findTemplateStep(stepId);
        step.setArchivedAt(Instant.now());
        templateSteps.save(step);
        auditService.record(actor, MODULE, "WORKFLOW_STEP_ARCHIVED", "Archived workflow step " + step.getStepName(), "WARNING");
    }

    @Transactional
    public ConditionResponse addTemplateCondition(UUID templateId, ConditionRequest request, AppUser actor) {
        requireFounder(actor);
        findTemplate(templateId);
        WorkflowCondition condition = conditionFrom(request);
        condition.setTemplateId(templateId);
        WorkflowCondition saved = conditions.saveAndFlush(condition);
        auditService.record(actor, MODULE, "WORKFLOW_CONDITION_CREATED", "Created workflow template condition " + saved.getFieldName(), "INFO");
        return ConditionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<WorkflowInstanceDetailResponse> instances(String query, WorkflowState state, WorkflowType workflowType, AppUser actor) {
        requireViewer(actor);
        return workflows.search(normalize(query), workflowType, state, null).stream().map(this::instanceResponse).toList();
    }

    @Transactional
    public WorkflowInstanceDetailResponse startWorkflow(StartWorkflowRequest request, AppUser actor) {
        requireRunner(actor);
        WorkflowTemplate template = request.templateId() == null ? null : findTemplate(request.templateId());
        if (template != null && template.getStatus() != WorkflowTemplateStatus.ACTIVE) {
            throw new ForbiddenOperationException("Only active workflow templates can be started.");
        }
        WorkflowInstance workflow = new WorkflowInstance();
        workflow.setWorkflowType(template == null ? request.workflowType() : template.getWorkflowType());
        workflow.setTitle(request.title().trim());
        workflow.setState(WorkflowState.RUNNING);
        workflow.setAssignee(blankToNull(request.assignee()));
        workflow.setRelatedModule(normalizeModule(request.relatedModule()));
        workflow.setRelatedRecordId(request.relatedRecordId());
        workflow.setCreatedBy(actor.getDisplayName());
        WorkflowInstance saved = workflows.saveAndFlush(workflow);
        copyTemplateSteps(template, saved);
        addHistory(saved, actor, null, WorkflowState.RUNNING, blankToNull(request.note()) == null ? "Workflow started." : request.note().trim());
        createWorkflowNotification(saved, "Workflow started", "Workflow " + saved.getTitle() + " has started.", saved.getAssignee(), WorkflowNotificationStatus.PENDING);
        auditService.record(actor, MODULE, "WORKFLOW_STARTED", "Started workflow " + saved.getTitle(), "IMPORTANT");
        return instanceResponse(saved);
    }

    @Transactional
    public WorkflowInstanceDetailResponse command(UUID workflowId, ExecutionCommandRequest request, AppUser actor) {
        requireRunner(actor);
        WorkflowInstance workflow = findWorkflow(workflowId);
        ensureNotArchived(workflow.getArchivedAt(), "Archived workflows cannot be changed.");
        WorkflowState previous = workflow.getState();
        WorkflowState next = nextState(request.command());
        if (request.command() == WorkflowExecutionCommand.RESTART) {
            resetInstanceSteps(workflow.getId());
        }
        workflow.setState(next);
        if (next == WorkflowState.ARCHIVED) workflow.setArchivedAt(Instant.now());
        WorkflowInstance saved = workflows.saveAndFlush(workflow);
        addHistory(saved, actor, previous, next, blankToNull(request.note()));
        createWorkflowNotification(saved, "Workflow state changed", "Workflow moved from " + previous + " to " + next + ".", saved.getAssignee(), WorkflowNotificationStatus.PENDING);
        auditService.record(actor, MODULE, "WORKFLOW_COMMAND_" + request.command().name(), "Changed workflow " + saved.getTitle() + " from " + previous + " to " + next, "IMPORTANT");
        return instanceResponse(saved);
    }

    @Transactional
    public WorkflowInstanceDetailResponse updateInstanceStep(UUID workflowId, UUID stepId, InstanceStepStatusRequest request, AppUser actor) {
        requireRunner(actor);
        WorkflowInstance workflow = findWorkflow(workflowId);
        WorkflowInstanceStep step = instanceSteps.findById(stepId).orElseThrow(() -> new NotFoundException("Workflow step not found."));
        if (!workflow.getId().equals(step.getWorkflowInstanceId())) throw new NotFoundException("Workflow step not found.");
        step.setStatus(request.status());
        if (request.status() == WorkflowStepStatus.IN_PROGRESS && step.getStartedAt() == null) step.setStartedAt(Instant.now());
        if (isTerminal(request.status())) step.setCompletedAt(Instant.now());
        step.setNote(blankToNull(request.note()));
        instanceSteps.saveAndFlush(step);
        addHistory(workflow, actor, workflow.getState(), workflow.getState(), "Step " + step.getStepName() + " changed to " + request.status());
        auditService.record(actor, MODULE, "WORKFLOW_STEP_STATUS_CHANGED", "Changed workflow step " + step.getStepName() + " to " + request.status(), "INFO");
        return instanceResponse(workflow);
    }

    @Transactional(readOnly = true)
    public List<ActionResponse> actions(UUID workflowInstanceId, WorkflowActionType actionType, WorkflowActionStatus status, AppUser actor) {
        requireViewer(actor);
        return actions.search(workflowInstanceId, actionType, status).stream().map(ActionResponse::from).toList();
    }

    @Transactional
    public ActionResponse createAction(ActionRequest request, AppUser actor) {
        requireRunner(actor);
        WorkflowAction action = new WorkflowAction();
        action.setTemplateId(request.templateId());
        action.setWorkflowInstanceId(request.workflowInstanceId());
        action.setInstanceStepId(request.instanceStepId());
        action.setActionType(request.actionType());
        action.setActionName(request.actionName().trim());
        action.setPayload(blankToNull(request.payload()));
        action.setStatus(request.status() == null ? WorkflowActionStatus.PENDING : request.status());
        if (action.getStatus() == WorkflowActionStatus.COMPLETED) action.setExecutedAt(Instant.now());
        action.setCreatedBy(actor.getDisplayName());
        WorkflowAction saved = actions.saveAndFlush(action);
        auditService.record(actor, MODULE, "WORKFLOW_ACTION_CREATED", "Created workflow action " + saved.getActionName(), "INFO");
        return ActionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<RuleResponse> rules(String query, WorkflowRuleStatus status, AppUser actor) {
        requireViewer(actor);
        return rules.search(normalize(query), status).stream().map(this::ruleResponse).toList();
    }

    @Transactional
    public RuleResponse createRule(RuleRequest request, AppUser actor) {
        requireFounder(actor);
        WorkflowRule rule = new WorkflowRule();
        apply(rule, request);
        rule.setCreatedBy(actor.getDisplayName());
        WorkflowRule saved = rules.saveAndFlush(rule);
        auditService.record(actor, MODULE, "WORKFLOW_RULE_CREATED", "Created workflow rule " + saved.getRuleName(), "IMPORTANT");
        return ruleResponse(saved);
    }

    @Transactional
    public RuleResponse updateRule(UUID id, RuleRequest request, AppUser actor) {
        requireFounder(actor);
        WorkflowRule rule = findRule(id);
        ensureNotArchived(rule.getArchivedAt(), "Archived rules cannot be changed.");
        apply(rule, request);
        WorkflowRule saved = rules.saveAndFlush(rule);
        auditService.record(actor, MODULE, "WORKFLOW_RULE_UPDATED", "Updated workflow rule " + saved.getRuleName(), "IMPORTANT");
        return ruleResponse(saved);
    }

    @Transactional
    public void archiveRule(UUID id, AppUser actor) {
        requireFounder(actor);
        WorkflowRule rule = findRule(id);
        rule.setStatus(WorkflowRuleStatus.ARCHIVED);
        rule.setArchivedAt(Instant.now());
        rules.save(rule);
        auditService.record(actor, MODULE, "WORKFLOW_RULE_ARCHIVED", "Archived workflow rule " + rule.getRuleName(), "WARNING");
    }

    @Transactional
    public ConditionResponse addRuleCondition(UUID ruleId, ConditionRequest request, AppUser actor) {
        requireFounder(actor);
        findRule(ruleId);
        WorkflowCondition condition = conditionFrom(request);
        condition.setRuleId(ruleId);
        WorkflowCondition saved = conditions.saveAndFlush(condition);
        auditService.record(actor, MODULE, "WORKFLOW_RULE_CONDITION_CREATED", "Created workflow rule condition " + saved.getFieldName(), "INFO");
        return ConditionResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ScheduledJobResponse> scheduledJobs(String query, ScheduledJobStatus status, AppUser actor) {
        requireViewer(actor);
        return scheduledJobs.search(normalize(query), status).stream().map(ScheduledJobResponse::from).toList();
    }

    @Transactional
    public ScheduledJobResponse createScheduledJob(ScheduledJobRequest request, AppUser actor) {
        requireFounder(actor);
        ScheduledJob job = new ScheduledJob();
        apply(job, request);
        job.setCreatedBy(actor.getDisplayName());
        ScheduledJob saved = scheduledJobs.saveAndFlush(job);
        auditService.record(actor, MODULE, "SCHEDULED_JOB_CREATED", "Created scheduled workflow job " + saved.getJobName(), "IMPORTANT");
        return ScheduledJobResponse.from(saved);
    }

    @Transactional
    public ScheduledJobResponse updateScheduledJob(UUID id, ScheduledJobRequest request, AppUser actor) {
        requireFounder(actor);
        ScheduledJob job = findScheduledJob(id);
        ensureNotArchived(job.getArchivedAt(), "Archived jobs cannot be changed.");
        apply(job, request);
        ScheduledJob saved = scheduledJobs.saveAndFlush(job);
        auditService.record(actor, MODULE, "SCHEDULED_JOB_UPDATED", "Updated scheduled workflow job " + saved.getJobName(), "IMPORTANT");
        return ScheduledJobResponse.from(saved);
    }

    @Transactional
    public void archiveScheduledJob(UUID id, AppUser actor) {
        requireFounder(actor);
        ScheduledJob job = findScheduledJob(id);
        job.setStatus(ScheduledJobStatus.ARCHIVED);
        job.setArchivedAt(Instant.now());
        scheduledJobs.save(job);
        auditService.record(actor, MODULE, "SCHEDULED_JOB_ARCHIVED", "Archived scheduled workflow job " + job.getJobName(), "WARNING");
    }

    @Transactional(readOnly = true)
    public WorkflowReportResponse report(WorkflowReportType type, AppUser actor) {
        requireViewer(actor);
        List<WorkflowInstance> activeWorkflows = activeWorkflows();
        List<WorkflowMetric> metrics = switch (type) {
            case WORKFLOW_PERFORMANCE -> List.of(
                metric("Running", countWorkflows(activeWorkflows, WorkflowState.RUNNING), "neutral"),
                metric("Completed", countWorkflows(activeWorkflows, WorkflowState.COMPLETED), "positive"),
                metric("Average completion", averageCompletionTime(activeWorkflows), "neutral")
            );
            case APPROVAL -> List.of(
                metric("Pending approvals", countWorkflows(activeWorkflows, WorkflowState.PENDING_APPROVAL), "warning"),
                metric("Approved", countWorkflows(activeWorkflows, WorkflowState.APPROVED), "positive"),
                metric("Rejected", countWorkflows(activeWorkflows, WorkflowState.REJECTED), "negative")
            );
            case AUTOMATION -> List.of(
                metric("Actions pending", actions.countByStatusAndArchivedAtIsNull(WorkflowActionStatus.PENDING), "warning"),
                metric("Actions completed", actions.countByStatusAndArchivedAtIsNull(WorkflowActionStatus.COMPLETED), "positive"),
                metric("Active rules", rules.countByStatusAndArchivedAtIsNull(WorkflowRuleStatus.ACTIVE), "neutral")
            );
            case SLA -> List.of(
                metric("Paused workflows", countWorkflows(activeWorkflows, WorkflowState.PAUSED), "warning"),
                metric("Failed workflows", countWorkflows(activeWorkflows, WorkflowState.FAILED), "negative"),
                metric("Escalated workflows", countWorkflows(activeWorkflows, WorkflowState.ESCALATED), "warning")
            );
            case ESCALATION -> List.of(
                metric("Escalated workflows", countWorkflows(activeWorkflows, WorkflowState.ESCALATED), "warning"),
                metric("Escalated steps", instanceSteps.countByStatus(WorkflowStepStatus.ESCALATED), "warning")
            );
            case WORKFLOW_AUDIT -> List.of(
                metric("Workflow history records", history.count(), "neutral"),
                metric("Workflow notifications", workflowNotifications.count(), "neutral")
            );
        };
        auditService.record(actor, MODULE, "WORKFLOW_REPORT_GENERATED", "Generated workflow report " + type, "INFO");
        return new WorkflowReportResponse(type, Instant.now(), metrics, activeWorkflows.isEmpty() ? List.of("No workflow records have been added yet.") : List.of("Report generated from stored workflow records only."));
    }

    private TemplateResponse templateResponse(WorkflowTemplate template) {
        return TemplateResponse.from(template, templateSteps.findByTemplateIdAndArchivedAtIsNullOrderByStepOrderAsc(template.getId()), conditions.findByTemplateIdAndArchivedAtIsNullOrderByCreatedAtAsc(template.getId()));
    }

    private RuleResponse ruleResponse(WorkflowRule rule) {
        return RuleResponse.from(rule, conditions.findByRuleIdAndArchivedAtIsNullOrderByCreatedAtAsc(rule.getId()));
    }

    private WorkflowInstanceDetailResponse instanceResponse(WorkflowInstance workflow) {
        List<WorkflowAction> actionRows = actions.search(workflow.getId(), null, null);
        return new WorkflowInstanceDetailResponse(
            workflow.getId(),
            workflow.getWorkflowType(),
            workflow.getTitle(),
            workflow.getState(),
            workflow.getAssignee(),
            workflow.getRelatedModule(),
            workflow.getRelatedRecordId(),
            workflow.getCreatedBy(),
            workflow.getCreatedAt(),
            workflow.getUpdatedAt(),
            instanceSteps.findByWorkflowInstanceIdOrderByStepOrderAsc(workflow.getId()).stream().map(WorkflowAutomationDto.InstanceStepResponse::from).toList(),
            actionRows.stream().map(ActionResponse::from).toList(),
            workflowNotifications.findByWorkflowInstanceIdAndArchivedAtIsNullOrderByCreatedAtDesc(workflow.getId()).stream().map(WorkflowNotificationResponse::from).toList(),
            history.findByWorkflowIdOrderByCreatedAtAsc(workflow.getId()).stream().map(WorkflowHistoryResponse::from).toList()
        );
    }

    private void copyTemplateSteps(WorkflowTemplate template, WorkflowInstance workflow) {
        if (template == null) return;
        List<WorkflowTemplateStep> steps = templateSteps.findByTemplateIdAndArchivedAtIsNullOrderByStepOrderAsc(template.getId());
        for (WorkflowTemplateStep source : steps) {
            WorkflowInstanceStep step = new WorkflowInstanceStep();
            step.setWorkflowInstanceId(workflow.getId());
            step.setTemplateStepId(source.getId());
            step.setStepOrder(source.getStepOrder());
            step.setStepName(source.getStepName());
            step.setStepType(source.getStepType());
            step.setApprovalMode(source.getApprovalMode());
            step.setApprover(source.getApproverUser() == null ? source.getApproverRole() : source.getApproverUser());
            step.setStatus(source.getStepOrder() == 1 ? WorkflowStepStatus.IN_PROGRESS : WorkflowStepStatus.PENDING);
            if (source.getStepOrder() == 1) step.setStartedAt(Instant.now());
            instanceSteps.save(step);
        }
    }

    private void resetInstanceSteps(UUID workflowId) {
        List<WorkflowInstanceStep> rows = instanceSteps.findByWorkflowInstanceIdOrderByStepOrderAsc(workflowId);
        for (WorkflowInstanceStep step : rows) {
            step.setStatus(WorkflowStepStatus.PENDING);
            step.setStartedAt(null);
            step.setCompletedAt(null);
            step.setNote(null);
        }
        instanceSteps.saveAll(rows);
    }

    private void createWorkflowNotification(WorkflowInstance workflow, String title, String message, String recipient, WorkflowNotificationStatus status) {
        WorkflowNotification notification = new WorkflowNotification();
        notification.setWorkflowInstanceId(workflow.getId());
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setRecipient(recipient);
        notification.setStatus(status);
        workflowNotifications.save(notification);
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

    private void apply(WorkflowTemplate template, TemplateRequest request) {
        template.setTemplateName(request.templateName().trim());
        template.setWorkflowType(request.workflowType());
        template.setDescription(blankToNull(request.description()));
        template.setStatus(request.status());
        template.setTriggerType(request.triggerType());
        template.setTriggerModule(normalizeModule(request.triggerModule()));
        template.setConditionsSummary(blankToNull(request.conditionsSummary()));
        template.setCompletionRules(blankToNull(request.completionRules()));
    }

    private void apply(WorkflowTemplateStep step, StepRequest request) {
        step.setStepOrder(request.stepOrder());
        step.setStepName(request.stepName().trim());
        step.setStepType(request.stepType());
        step.setApprovalMode(request.approvalMode());
        step.setApproverRole(normalizeModule(request.approverRole()));
        step.setApproverUser(blankToNull(request.approverUser()));
        step.setActionType(request.actionType());
        step.setNotificationAudience(normalizeModule(request.notificationAudience()));
        step.setEscalationAfterHours(request.escalationAfterHours());
        step.setConditionsSummary(blankToNull(request.conditionsSummary()));
        step.setCompletionRule(blankToNull(request.completionRule()));
        step.setRequiredStep(request.requiredStep() == null || request.requiredStep());
    }

    private void apply(WorkflowRule rule, RuleRequest request) {
        rule.setRuleName(request.ruleName().trim());
        rule.setTriggerModule(normalizeModule(request.triggerModule()));
        rule.setTriggerEvent(request.triggerEvent().trim().toUpperCase());
        rule.setConditionSummary(blankToNull(request.conditionSummary()));
        rule.setActionSummary(blankToNull(request.actionSummary()));
        rule.setStatus(request.status());
    }

    private void apply(ScheduledJob job, ScheduledJobRequest request) {
        if (request.frequency() == WorkflowAutomationEnums.ScheduledJobFrequency.CRON && blankToNull(request.cronExpression()) == null) {
            throw new IllegalArgumentException("Cron expression is required for CRON scheduled jobs.");
        }
        job.setJobName(request.jobName().trim());
        job.setJobKey(request.jobKey().trim().toUpperCase());
        job.setFrequency(request.frequency());
        job.setCronExpression(blankToNull(request.cronExpression()));
        job.setNextRunAt(request.nextRunAt());
        job.setStatus(request.status());
        job.setActionSummary(blankToNull(request.actionSummary()));
    }

    private WorkflowCondition conditionFrom(ConditionRequest request) {
        WorkflowCondition condition = new WorkflowCondition();
        condition.setFieldName(request.fieldName().trim());
        condition.setOperator(request.operator());
        condition.setExpectedValue(blankToNull(request.expectedValue()));
        condition.setDescription(blankToNull(request.description()));
        return condition;
    }

    private WorkflowState nextState(WorkflowExecutionCommand command) {
        return switch (command) {
            case START, RESUME, RESTART -> WorkflowState.RUNNING;
            case PAUSE -> WorkflowState.PAUSED;
            case CANCEL -> WorkflowState.CANCELLED;
            case COMPLETE -> WorkflowState.COMPLETED;
            case FAIL -> WorkflowState.FAILED;
            case ESCALATE -> WorkflowState.ESCALATED;
        };
    }

    private boolean isTerminal(WorkflowStepStatus status) {
        return status == WorkflowStepStatus.APPROVED || status == WorkflowStepStatus.REJECTED || status == WorkflowStepStatus.COMPLETED || status == WorkflowStepStatus.SKIPPED || status == WorkflowStepStatus.FAILED;
    }

    private WorkflowTemplate findTemplate(UUID id) {
        return templates.findById(id).orElseThrow(() -> new NotFoundException("Workflow template not found."));
    }

    private WorkflowTemplateStep findTemplateStep(UUID id) {
        return templateSteps.findById(id).orElseThrow(() -> new NotFoundException("Workflow step not found."));
    }

    private WorkflowInstance findWorkflow(UUID id) {
        return workflows.findById(id).orElseThrow(() -> new NotFoundException("Workflow not found."));
    }

    private WorkflowRule findRule(UUID id) {
        return rules.findById(id).orElseThrow(() -> new NotFoundException("Workflow rule not found."));
    }

    private ScheduledJob findScheduledJob(UUID id) {
        return scheduledJobs.findById(id).orElseThrow(() -> new NotFoundException("Scheduled job not found."));
    }

    private List<WorkflowInstance> activeWorkflows() {
        return workflows.findAll().stream()
            .filter(workflow -> workflow.getArchivedAt() == null)
            .sorted(Comparator.comparing(WorkflowInstance::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
            .toList();
    }

    private long countWorkflows(List<WorkflowInstance> rows, WorkflowState state) {
        return rows.stream().filter(workflow -> workflow.getState() == state).count();
    }

    private String averageCompletionTime(List<WorkflowInstance> rows) {
        List<Long> minutes = rows.stream()
            .filter(workflow -> workflow.getState() == WorkflowState.COMPLETED)
            .filter(workflow -> workflow.getCreatedAt() != null && workflow.getUpdatedAt() != null)
            .map(workflow -> Duration.between(workflow.getCreatedAt(), workflow.getUpdatedAt()).toMinutes())
            .toList();
        if (minutes.isEmpty()) return "No completed workflows";
        long average = Math.round(minutes.stream().mapToLong(Long::longValue).average().orElse(0));
        return average + " minute(s)";
    }

    private WorkflowMetric metric(String label, long value, String tone) {
        return new WorkflowMetric(label, String.valueOf(value), tone);
    }

    private WorkflowMetric metric(String label, String value, String tone) {
        return new WorkflowMetric(label, value, tone);
    }

    private void ensureNotArchived(Instant archivedAt, String message) {
        if (archivedAt != null) throw new ForbiddenOperationException(message);
    }

    private void requireFounder(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER); }
    private void requireRunner(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String normalize(String value) { return value == null ? null : value.trim(); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private String normalizeModule(String value) { return value == null || value.isBlank() ? null : value.trim().toUpperCase(); }
}
