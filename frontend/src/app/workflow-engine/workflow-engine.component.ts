import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ApiService } from '../core/http/api.service';
import {
  ScheduledJobRecord,
  WorkflowEngineState,
  WorkflowEngineSummary,
  WorkflowEngineType,
  WorkflowExecutionCommand,
  WorkflowInstanceRecord,
  WorkflowReportRecord,
  WorkflowReportType,
  WorkflowRuleRecord,
  WorkflowStepPayload, WorkflowTemplateRecord
} from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

type WorkflowTab = 'monitor' | 'templates' | 'instances' | 'rules' | 'scheduler' | 'reports';

@Component({
  selector: 'kravia-workflow-engine',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './workflow-engine.component.html'
})
export class WorkflowEngineComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly tabs: { key: WorkflowTab; label: string }[] = [
    { key: 'monitor', label: 'Monitor' },
    { key: 'templates', label: 'Designer' },
    { key: 'instances', label: 'Execution' },
    { key: 'rules', label: 'Rules' },
    { key: 'scheduler', label: 'Scheduler' },
    { key: 'reports', label: 'Reports' }
  ];
  readonly workflowTypes: WorkflowEngineType[] = ['BOARD_MEETING_APPROVAL', 'PURCHASE_APPROVAL', 'VENDOR_ONBOARDING', 'EXPENSE_APPROVAL', 'CONTRACT_REVIEW', 'COMPLIANCE_FILING', 'LEAVE_APPROVAL', 'RECRUITMENT_APPROVAL', 'PRODUCT_RELEASE_APPROVAL', 'CUSTOMER_ONBOARDING', 'GENERAL'];
  readonly workflowStates: WorkflowEngineState[] = ['RUNNING', 'PENDING_APPROVAL', 'PAUSED', 'ESCALATED', 'FAILED', 'COMPLETED', 'CANCELLED'];
  readonly commands: WorkflowExecutionCommand[] = ['PAUSE', 'RESUME', 'COMPLETE', 'RESTART', 'FAIL', 'ESCALATE', 'CANCEL'];
  readonly reportTypes: WorkflowReportType[] = ['WORKFLOW_PERFORMANCE', 'APPROVAL', 'AUTOMATION', 'SLA', 'ESCALATION', 'WORKFLOW_AUDIT'];

  readonly activeTab = signal<WorkflowTab>('monitor');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly summary = signal<WorkflowEngineSummary | null>(null);
  readonly templates = signal<WorkflowTemplateRecord[]>([]);
  readonly instances = signal<WorkflowInstanceRecord[]>([]);
  readonly rules = signal<WorkflowRuleRecord[]>([]);
  readonly jobs = signal<ScheduledJobRecord[]>([]);
  readonly report = signal<WorkflowReportRecord | null>(null);

  readonly canAdmin = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly canRun = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));

  readonly templateForm = this.fb.nonNullable.group({
    templateName: ['', Validators.required],
    workflowType: this.fb.nonNullable.control<WorkflowEngineType>('GENERAL'),
    description: '',
    status: this.fb.nonNullable.control<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'>('DRAFT'),
    triggerType: this.fb.nonNullable.control<'MANUAL' | 'RECORD_CREATED' | 'RECORD_UPDATED' | 'STATUS_CHANGED' | 'SCHEDULED' | 'DATE_BASED'>('MANUAL'),
    triggerModule: '',
    conditionsSummary: '',
    completionRules: ''
  });
  readonly stepForm = this.fb.nonNullable.group({
    templateId: ['', Validators.required],
    stepOrder: 1,
    stepName: ['', Validators.required],
    stepType: this.fb.nonNullable.control<'APPROVAL' | 'REVIEW' | 'TASK' | 'NOTIFICATION' | 'AUTOMATION' | 'CONDITION' | 'DOCUMENT' | 'WAIT'>('REVIEW'),
    approvalMode: this.fb.control<'SINGLE' | 'SEQUENTIAL' | 'PARALLEL' | 'MULTI_LEVEL' | 'QUORUM' | 'CONDITIONAL' | null>(null),
    approverRole: '',
    approverUser: '',
    actionType: this.fb.control<'CREATE_TASK' | 'SEND_NOTIFICATION' | 'SEND_EMAIL' | 'CREATE_APPROVAL' | 'GENERATE_DOCUMENT' | 'UPDATE_STATUS' | 'CREATE_AUDIT_LOG' | 'SCHEDULE_REMINDER' | 'LINK_RECORDS' | null>(null),
    escalationAfterHours: 0,
    conditionsSummary: '',
    completionRule: '',
    requiredStep: true
  });
  readonly startForm = this.fb.nonNullable.group({
    templateId: '',
    workflowType: this.fb.nonNullable.control<WorkflowEngineType>('GENERAL'),
    title: ['', Validators.required],
    assignee: '',
    relatedModule: '',
    relatedRecordId: '',
    note: ''
  });
  readonly ruleForm = this.fb.nonNullable.group({
    ruleName: ['', Validators.required],
    triggerModule: ['', Validators.required],
    triggerEvent: ['', Validators.required],
    conditionSummary: '',
    actionSummary: '',
    status: this.fb.nonNullable.control<'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED'>('DRAFT')
  });
  readonly jobForm = this.fb.nonNullable.group({
    jobName: ['', Validators.required],
    jobKey: ['', Validators.required],
    frequency: this.fb.nonNullable.control<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY' | 'CRON'>('DAILY'),
    cronExpression: '',
    nextRunAt: '',
    status: this.fb.nonNullable.control<'ACTIVE' | 'PAUSED' | 'FAILED' | 'ARCHIVED'>('ACTIVE'),
    actionSummary: ''
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.workflowSummary(),
      templates: this.api.workflowTemplates({}),
      instances: this.api.workflowInstances({}),
      rules: this.api.workflowRules({}),
      jobs: this.api.scheduledWorkflowJobs({})
    }).subscribe({
      next: (data) => {
        this.summary.set(data.summary);
        this.templates.set(data.templates);
        this.instances.set(data.instances);
        this.rules.set(data.rules);
        this.jobs.set(data.jobs);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load workflow engine records.');
        this.loading.set(false);
      }
    });
  }

  saveTemplate(): void {
    if (this.templateForm.invalid || !this.canAdmin()) return;
    this.run(this.api.createWorkflowTemplate(this.clean(this.templateForm.getRawValue())), 'Workflow template created.', () => this.templateForm.reset({ workflowType: 'GENERAL', status: 'DRAFT', triggerType: 'MANUAL' }));
  }

  addStep(): void {
    if (this.stepForm.invalid || !this.canAdmin()) return;
    const value = this.stepForm.getRawValue();
    const templateId = value.templateId;
    const { templateId: _templateId, ...payload } = value;
    this.run(this.api.addWorkflowStep(templateId, this.clean(payload) as WorkflowStepPayload), 'Workflow step added.', () => this.stepForm.reset({ stepOrder: 1, stepType: 'REVIEW', escalationAfterHours: 0, requiredStep: true }));
  }

  startWorkflow(): void {
    if (this.startForm.invalid || !this.canRun()) return;
    const value = this.clean(this.startForm.getRawValue());
    this.run(this.api.startWorkflow(value), 'Workflow started.', () => this.startForm.reset({ workflowType: 'GENERAL' }));
  }

  executeCommand(instance: WorkflowInstanceRecord, command: WorkflowExecutionCommand): void {
    if (!this.canRun()) return;
    this.run(this.api.commandWorkflow(instance.id, { command }), `Workflow ${this.label(command)}.`, undefined);
  }

  saveRule(): void {
    if (this.ruleForm.invalid || !this.canAdmin()) return;
    this.run(this.api.createWorkflowRule(this.clean(this.ruleForm.getRawValue())), 'Workflow rule created.', () => this.ruleForm.reset({ status: 'DRAFT' }));
  }

  saveJob(): void {
    if (this.jobForm.invalid || !this.canAdmin()) return;
    this.run(this.api.createScheduledWorkflowJob(this.clean(this.jobForm.getRawValue())), 'Scheduled job created.', () => this.jobForm.reset({ frequency: 'DAILY', status: 'ACTIVE' }));
  }

  generateReport(type: WorkflowReportType): void {
    this.run(this.api.workflowReport(type), 'Workflow report generated.', (report) => this.report.set(report));
  }

  archiveTemplate(id: string): void {
    if (!this.canAdmin()) return;
    this.run(this.api.archiveWorkflowTemplate(id), 'Workflow template archived.', undefined);
  }

  archiveRule(id: string): void {
    if (!this.canAdmin()) return;
    this.run(this.api.archiveWorkflowRule(id), 'Workflow rule archived.', undefined);
  }

  archiveJob(id: string): void {
    if (!this.canAdmin()) return;
    this.run(this.api.archiveScheduledWorkflowJob(id), 'Scheduled job archived.', undefined);
  }

  label(value: string): string {
    return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private run<T>(request: Observable<T>, message: string, afterSuccess?: (value: T) => void): void {
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    request.subscribe({
      next: (value) => {
        afterSuccess?.(value);
        this.success.set(message);
        this.saving.set(false);
        this.load();
      },
      error: () => {
        this.error.set('Workflow action failed.');
        this.saving.set(false);
      }
    });
  }

  private clean<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item === '' || item === null ? undefined : item])) as T;
  }
}
