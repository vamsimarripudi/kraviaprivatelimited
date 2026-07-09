package com.kravia.companyos.platform;

import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowNotificationStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowNotificationRepository extends JpaRepository<WorkflowNotification, UUID> {
    List<WorkflowNotification> findByWorkflowInstanceIdAndArchivedAtIsNullOrderByCreatedAtDesc(UUID workflowInstanceId);
    long countByStatusAndArchivedAtIsNull(WorkflowNotificationStatus status);
}
