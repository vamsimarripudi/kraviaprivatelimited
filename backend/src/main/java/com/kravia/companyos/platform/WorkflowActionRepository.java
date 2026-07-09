package com.kravia.companyos.platform;

import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionStatus;
import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowActionType;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkflowActionRepository extends JpaRepository<WorkflowAction, UUID> {
    long countByStatusAndArchivedAtIsNull(WorkflowActionStatus status);

    @Query("""
        select a from WorkflowAction a
        where a.archivedAt is null
          and (:workflowInstanceId is null or a.workflowInstanceId = :workflowInstanceId)
          and (:actionType is null or a.actionType = :actionType)
          and (:status is null or a.status = :status)
        order by a.updatedAt desc
    """)
    List<WorkflowAction> search(
        @Param("workflowInstanceId") UUID workflowInstanceId,
        @Param("actionType") WorkflowActionType actionType,
        @Param("status") WorkflowActionStatus status
    );
}
