package com.kravia.companyos.platform;

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
import com.kravia.companyos.platform.WorkflowAutomationDto.WorkflowReportResponse;
import com.kravia.companyos.platform.WorkflowAutomationEnums.ScheduledJobStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowReportType;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowRuleStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowTemplateStatus;
import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/workflow-engine")
public class WorkflowAutomationController {
    private final WorkflowAutomationService service;

    public WorkflowAutomationController(WorkflowAutomationService service) {
        this.service = service;
    }

    @GetMapping("/summary")
    public WorkflowEngineSummary summary(@AuthenticationPrincipal AppUser actor) {
        return service.summary(actor);
    }

    @GetMapping("/templates")
    public List<TemplateResponse> templates(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) WorkflowTemplateStatus status,
        @RequestParam(required = false) WorkflowType workflowType,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.templates(q, status, workflowType, actor);
    }

    @PostMapping("/templates")
    public TemplateResponse createTemplate(@Valid @RequestBody TemplateRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createTemplate(request, actor);
    }

    @PutMapping("/templates/{id}")
    public TemplateResponse updateTemplate(@PathVariable UUID id, @Valid @RequestBody TemplateRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateTemplate(id, request, actor);
    }

    @DeleteMapping("/templates/{id}")
    public void archiveTemplate(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveTemplate(id, actor);
    }

    @PostMapping("/templates/{id}/steps")
    public StepResponse addStep(@PathVariable UUID id, @Valid @RequestBody StepRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.addStep(id, request, actor);
    }

    @PutMapping("/steps/{id}")
    public StepResponse updateStep(@PathVariable UUID id, @Valid @RequestBody StepRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateStep(id, request, actor);
    }

    @DeleteMapping("/steps/{id}")
    public void archiveStep(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveStep(id, actor);
    }

    @PostMapping("/templates/{id}/conditions")
    public ConditionResponse addTemplateCondition(@PathVariable UUID id, @Valid @RequestBody ConditionRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.addTemplateCondition(id, request, actor);
    }

    @GetMapping("/instances")
    public List<WorkflowInstanceDetailResponse> instances(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) WorkflowState state,
        @RequestParam(required = false) WorkflowType workflowType,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.instances(q, state, workflowType, actor);
    }

    @PostMapping("/instances/start")
    public WorkflowInstanceDetailResponse startWorkflow(@Valid @RequestBody StartWorkflowRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.startWorkflow(request, actor);
    }

    @PatchMapping("/instances/{id}/command")
    public WorkflowInstanceDetailResponse command(@PathVariable UUID id, @Valid @RequestBody ExecutionCommandRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.command(id, request, actor);
    }

    @PatchMapping("/instances/{id}/steps/{stepId}")
    public WorkflowInstanceDetailResponse updateInstanceStep(@PathVariable UUID id, @PathVariable UUID stepId, @Valid @RequestBody InstanceStepStatusRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateInstanceStep(id, stepId, request, actor);
    }

    @GetMapping("/actions")
    public List<ActionResponse> actions(
        @RequestParam(required = false) UUID workflowInstanceId,
        @RequestParam(required = false) WorkflowActionType actionType,
        @RequestParam(required = false) WorkflowActionStatus status,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.actions(workflowInstanceId, actionType, status, actor);
    }

    @PostMapping("/actions")
    public ActionResponse createAction(@Valid @RequestBody ActionRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createAction(request, actor);
    }

    @GetMapping("/rules")
    public List<RuleResponse> rules(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) WorkflowRuleStatus status,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.rules(q, status, actor);
    }

    @PostMapping("/rules")
    public RuleResponse createRule(@Valid @RequestBody RuleRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createRule(request, actor);
    }

    @PutMapping("/rules/{id}")
    public RuleResponse updateRule(@PathVariable UUID id, @Valid @RequestBody RuleRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateRule(id, request, actor);
    }

    @DeleteMapping("/rules/{id}")
    public void archiveRule(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveRule(id, actor);
    }

    @PostMapping("/rules/{id}/conditions")
    public ConditionResponse addRuleCondition(@PathVariable UUID id, @Valid @RequestBody ConditionRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.addRuleCondition(id, request, actor);
    }

    @GetMapping("/scheduled-jobs")
    public List<ScheduledJobResponse> scheduledJobs(
        @RequestParam(required = false) String q,
        @RequestParam(required = false) ScheduledJobStatus status,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.scheduledJobs(q, status, actor);
    }

    @PostMapping("/scheduled-jobs")
    public ScheduledJobResponse createScheduledJob(@Valid @RequestBody ScheduledJobRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createScheduledJob(request, actor);
    }

    @PutMapping("/scheduled-jobs/{id}")
    public ScheduledJobResponse updateScheduledJob(@PathVariable UUID id, @Valid @RequestBody ScheduledJobRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateScheduledJob(id, request, actor);
    }

    @DeleteMapping("/scheduled-jobs/{id}")
    public void archiveScheduledJob(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveScheduledJob(id, actor);
    }

    @GetMapping("/reports")
    public WorkflowReportResponse report(@RequestParam WorkflowReportType type, @AuthenticationPrincipal AppUser actor) {
        return service.report(type, actor);
    }
}
