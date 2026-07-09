package com.kravia.companyos.platform;

import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowStepStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowInstanceStepRepository extends JpaRepository<WorkflowInstanceStep, UUID> {
    List<WorkflowInstanceStep> findByWorkflowInstanceIdOrderByStepOrderAsc(UUID workflowInstanceId);
    long countByStatus(WorkflowStepStatus status);
}
