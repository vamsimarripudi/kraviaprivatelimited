package com.kravia.companyos.platform;

import com.kravia.companyos.platform.WorkflowAutomationEnums.ScheduledJobFrequency;
import com.kravia.companyos.platform.WorkflowAutomationEnums.ScheduledJobStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowApprovalMode;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowConditionOperator;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowExecutionCommand;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowNotificationStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowReportType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowRuleStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowStepStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowStepType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowTemplateStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowTriggerType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class WorkflowAutomationDto {
    private WorkflowAutomationDto() {}

    public record WorkflowMetric(String label, String value, String tone) {}

    public record WorkflowEngineSummary(
        long templates,
        long activeTemplates,
        long runningWorkflows,
        long pausedWorkflows,
        long completedWorkflows,
        long failedWorkflows,
        long escalatedWorkflows,
        long pendingActions,
        long activeRules,
        long activeScheduledJobs,
        String averageCompletionTime,
        List<WorkflowMetric> metrics,
        List<String> emptyStates
    ) {}

    public record TemplateRequest(
        @NotBlank @Size(max = 200) String templateName,
        @NotNull WorkflowType workflowType,
        @Size(max = 3000) String description,
        @NotNull WorkflowTemplateStatus status,
        @NotNull WorkflowTriggerType triggerType,
        @Size(max = 80) String triggerModule,
        @Size(max = 3000) String conditionsSummary,
        @Size(max = 3000) String completionRules
    ) {}

    public record TemplateResponse(
        UUID id,
        String templateName,
        WorkflowType workflowType,
        String description,
        WorkflowTemplateStatus status,
        WorkflowTriggerType triggerType,
        String triggerModule,
        String conditionsSummary,
        String completionRules,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        List<StepResponse> steps,
        List<ConditionResponse> conditions
    ) {
        public static TemplateResponse from(WorkflowTemplate template, List<WorkflowTemplateStep> steps, List<WorkflowCondition> conditions) {
            return new TemplateResponse(
                template.getId(),
                template.getTemplateName(),
                template.getWorkflowType(),
                template.getDescription(),
                template.getStatus(),
                template.getTriggerType(),
                template.getTriggerModule(),
                template.getConditionsSummary(),
                template.getCompletionRules(),
                template.getCreatedBy(),
                template.getCreatedAt(),
                template.getUpdatedAt(),
                steps.stream().map(StepResponse::from).toList(),
                conditions.stream().map(ConditionResponse::from).toList()
            );
        }
    }

    public record StepRequest(
        @NotNull @Min(1) Integer stepOrder,
        @NotBlank @Size(max = 200) String stepName,
        @NotNull WorkflowStepType stepType,
        WorkflowApprovalMode approvalMode,
        @Size(max = 80) String approverRole,
        @Size(max = 320) String approverUser,
        WorkflowActionType actionType,
        @Size(max = 80) String notificationAudience,
        @Min(0) Integer escalationAfterHours,
        @Size(max = 3000) String conditionsSummary,
        @Size(max = 3000) String completionRule,
        Boolean requiredStep
    ) {}

    public record StepResponse(
        UUID id,
        UUID templateId,
        Integer stepOrder,
        String stepName,
        WorkflowStepType stepType,
        WorkflowApprovalMode approvalMode,
        String approverRole,
        String approverUser,
        WorkflowActionType actionType,
        String notificationAudience,
        Integer escalationAfterHours,
        String conditionsSummary,
        String completionRule,
        boolean requiredStep
    ) {
        public static StepResponse from(WorkflowTemplateStep step) {
            return new StepResponse(step.getId(), step.getTemplateId(), step.getStepOrder(), step.getStepName(), step.getStepType(), step.getApprovalMode(), step.getApproverRole(), step.getApproverUser(), step.getActionType(), step.getNotificationAudience(), step.getEscalationAfterHours(), step.getConditionsSummary(), step.getCompletionRule(), step.isRequiredStep());
        }
    }

    public record ConditionRequest(
        @NotBlank @Size(max = 160) String fieldName,
        @NotNull WorkflowConditionOperator operator,
        @Size(max = 1000) String expectedValue,
        @Size(max = 2000) String description
    ) {}

    public record ConditionResponse(
        UUID id,
        UUID templateId,
        UUID ruleId,
        String fieldName,
        WorkflowConditionOperator operator,
        String expectedValue,
        String description
    ) {
        public static ConditionResponse from(WorkflowCondition condition) {
            return new ConditionResponse(condition.getId(), condition.getTemplateId(), condition.getRuleId(), condition.getFieldName(), condition.getOperator(), condition.getExpectedValue(), condition.getDescription());
        }
    }

    public record StartWorkflowRequest(
        UUID templateId,
        @NotNull WorkflowType workflowType,
        @NotBlank @Size(max = 240) String title,
        @Size(max = 320) String assignee,
        @Size(max = 80) String relatedModule,
        UUID relatedRecordId,
        @Size(max = 1000) String note
    ) {}

    public record ExecutionCommandRequest(
        @NotNull WorkflowExecutionCommand command,
        @Size(max = 1000) String note
    ) {}

    public record InstanceStepStatusRequest(
        @NotNull WorkflowStepStatus status,
        @Size(max = 2000) String note
    ) {}

    public record InstanceStepResponse(
        UUID id,
        UUID workflowInstanceId,
        UUID templateStepId,
        Integer stepOrder,
        String stepName,
        WorkflowStepType stepType,
        WorkflowApprovalMode approvalMode,
        String approver,
        WorkflowStepStatus status,
        Instant startedAt,
        Instant completedAt,
        String note
    ) {
        public static InstanceStepResponse from(WorkflowInstanceStep step) {
            return new InstanceStepResponse(step.getId(), step.getWorkflowInstanceId(), step.getTemplateStepId(), step.getStepOrder(), step.getStepName(), step.getStepType(), step.getApprovalMode(), step.getApprover(), step.getStatus(), step.getStartedAt(), step.getCompletedAt(), step.getNote());
        }
    }

    public record WorkflowInstanceDetailResponse(
        UUID id,
        WorkflowType workflowType,
        String title,
        WorkflowState state,
        String assignee,
        String relatedModule,
        UUID relatedRecordId,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        List<InstanceStepResponse> steps,
        List<ActionResponse> actions,
        List<WorkflowNotificationResponse> notifications,
        List<WorkflowHistoryResponse> history
    ) {}

    public record ActionRequest(
        UUID templateId,
        UUID workflowInstanceId,
        UUID instanceStepId,
        @NotNull WorkflowActionType actionType,
        @NotBlank @Size(max = 200) String actionName,
        @Size(max = 5000) String payload,
        WorkflowActionStatus status
    ) {}

    public record ActionResponse(
        UUID id,
        UUID templateId,
        UUID workflowInstanceId,
        UUID instanceStepId,
        WorkflowActionType actionType,
        String actionName,
        String payload,
        WorkflowActionStatus status,
        Instant executedAt,
        String createdBy,
        Instant createdAt,
        Instant updatedAt
    ) {
        public static ActionResponse from(WorkflowAction action) {
            return new ActionResponse(action.getId(), action.getTemplateId(), action.getWorkflowInstanceId(), action.getInstanceStepId(), action.getActionType(), action.getActionName(), action.getPayload(), action.getStatus(), action.getExecutedAt(), action.getCreatedBy(), action.getCreatedAt(), action.getUpdatedAt());
        }
    }

    public record RuleRequest(
        @NotBlank @Size(max = 200) String ruleName,
        @NotBlank @Size(max = 80) String triggerModule,
        @NotBlank @Size(max = 120) String triggerEvent,
        @Size(max = 3000) String conditionSummary,
        @Size(max = 3000) String actionSummary,
        @NotNull WorkflowRuleStatus status
    ) {}

    public record RuleResponse(
        UUID id,
        String ruleName,
        String triggerModule,
        String triggerEvent,
        String conditionSummary,
        String actionSummary,
        WorkflowRuleStatus status,
        String createdBy,
        Instant createdAt,
        Instant updatedAt,
        List<ConditionResponse> conditions
    ) {
        public static RuleResponse from(WorkflowRule rule, List<WorkflowCondition> conditions) {
            return new RuleResponse(rule.getId(), rule.getRuleName(), rule.getTriggerModule(), rule.getTriggerEvent(), rule.getConditionSummary(), rule.getActionSummary(), rule.getStatus(), rule.getCreatedBy(), rule.getCreatedAt(), rule.getUpdatedAt(), conditions.stream().map(ConditionResponse::from).toList());
        }
    }

    public record ScheduledJobRequest(
        @NotBlank @Size(max = 200) String jobName,
        @NotBlank @Size(max = 160) String jobKey,
        @NotNull ScheduledJobFrequency frequency,
        @Size(max = 120) String cronExpression,
        Instant nextRunAt,
        @NotNull ScheduledJobStatus status,
        @Size(max = 3000) String actionSummary
    ) {}

    public record ScheduledJobResponse(
        UUID id,
        String jobName,
        String jobKey,
        ScheduledJobFrequency frequency,
        String cronExpression,
        Instant nextRunAt,
        Instant lastRunAt,
        ScheduledJobStatus status,
        String actionSummary,
        String createdBy,
        Instant createdAt,
        Instant updatedAt
    ) {
        public static ScheduledJobResponse from(ScheduledJob job) {
            return new ScheduledJobResponse(job.getId(), job.getJobName(), job.getJobKey(), job.getFrequency(), job.getCronExpression(), job.getNextRunAt(), job.getLastRunAt(), job.getStatus(), job.getActionSummary(), job.getCreatedBy(), job.getCreatedAt(), job.getUpdatedAt());
        }
    }

    public record WorkflowNotificationResponse(
        UUID id,
        UUID workflowInstanceId,
        String title,
        String message,
        String recipient,
        WorkflowNotificationStatus status,
        Instant sentAt,
        Instant createdAt
    ) {
        public static WorkflowNotificationResponse from(WorkflowNotification notification) {
            return new WorkflowNotificationResponse(notification.getId(), notification.getWorkflowInstanceId(), notification.getTitle(), notification.getMessage(), notification.getRecipient(), notification.getStatus(), notification.getSentAt(), notification.getCreatedAt());
        }
    }

    public record WorkflowReportResponse(
        WorkflowReportType reportType,
        Instant generatedAt,
        List<WorkflowMetric> metrics,
        List<String> notes
    ) {}
}
