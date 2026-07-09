package com.kravia.companyos.platform;

public final class WorkflowAutomationEnums {
    private WorkflowAutomationEnums() {}

    public enum WorkflowTemplateStatus {
        DRAFT,
        ACTIVE,
        PAUSED,
        ARCHIVED
    }

    public enum WorkflowTriggerType {
        MANUAL,
        RECORD_CREATED,
        RECORD_UPDATED,
        STATUS_CHANGED,
        SCHEDULED,
        DATE_BASED
    }

    public enum WorkflowStepType {
        APPROVAL,
        REVIEW,
        TASK,
        NOTIFICATION,
        AUTOMATION,
        CONDITION,
        DOCUMENT,
        WAIT
    }

    public enum WorkflowApprovalMode {
        SINGLE,
        SEQUENTIAL,
        PARALLEL,
        MULTI_LEVEL,
        QUORUM,
        CONDITIONAL
    }

    public enum WorkflowStepStatus {
        PENDING,
        IN_PROGRESS,
        APPROVED,
        REJECTED,
        COMPLETED,
        SKIPPED,
        FAILED,
        ESCALATED
    }

    public enum WorkflowActionType {
        CREATE_TASK,
        SEND_NOTIFICATION,
        SEND_EMAIL,
        CREATE_APPROVAL,
        GENERATE_DOCUMENT,
        UPDATE_STATUS,
        CREATE_AUDIT_LOG,
        SCHEDULE_REMINDER,
        LINK_RECORDS
    }

    public enum WorkflowActionStatus {
        PENDING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    public enum WorkflowConditionOperator {
        EQUALS,
        NOT_EQUALS,
        GREATER_THAN,
        GREATER_THAN_OR_EQUAL,
        LESS_THAN,
        LESS_THAN_OR_EQUAL,
        CONTAINS,
        EXISTS,
        BEFORE_DATE,
        AFTER_DATE
    }

    public enum WorkflowRuleStatus {
        DRAFT,
        ACTIVE,
        PAUSED,
        ARCHIVED
    }

    public enum WorkflowNotificationStatus {
        PENDING,
        SENT,
        FAILED,
        ARCHIVED
    }

    public enum ScheduledJobFrequency {
        DAILY,
        WEEKLY,
        MONTHLY,
        QUARTERLY,
        ANNUALLY,
        CRON
    }

    public enum ScheduledJobStatus {
        ACTIVE,
        PAUSED,
        FAILED,
        ARCHIVED
    }

    public enum WorkflowExecutionCommand {
        START,
        PAUSE,
        RESUME,
        CANCEL,
        COMPLETE,
        RESTART,
        FAIL,
        ESCALATE
    }

    public enum WorkflowReportType {
        WORKFLOW_PERFORMANCE,
        APPROVAL,
        AUTOMATION,
        SLA,
        ESCALATION,
        WORKFLOW_AUDIT
    }
}
