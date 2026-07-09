package com.kravia.companyos.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkflowInstanceRepository extends JpaRepository<WorkflowInstance, UUID> {
    long countByStateAndArchivedAtIsNull(WorkflowState state);

    @Query("""
        select w from WorkflowInstance w
        where w.archivedAt is null
          and (:query is null or :query = '' or lower(w.title) like lower(concat('%', :query, '%')) or lower(coalesce(w.assignee, '')) like lower(concat('%', :query, '%')))
          and (:workflowType is null or w.workflowType = :workflowType)
          and (:state is null or w.state = :state)
          and (:assignee is null or :assignee = '' or lower(coalesce(w.assignee, '')) like lower(concat('%', :assignee, '%')))
        order by w.updatedAt desc
    """)
    List<WorkflowInstance> search(@Param("query") String query, @Param("workflowType") WorkflowType workflowType, @Param("state") WorkflowState state, @Param("assignee") String assignee);
}
