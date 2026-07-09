package com.kravia.companyos.platform;

import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowRuleStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkflowRuleRepository extends JpaRepository<WorkflowRule, UUID> {
    long countByStatusAndArchivedAtIsNull(WorkflowRuleStatus status);

    @Query("""
        select r from WorkflowRule r
        where r.archivedAt is null
          and (:query is null or :query = '' or lower(r.ruleName) like lower(concat('%', :query, '%')) or lower(r.triggerModule) like lower(concat('%', :query, '%')))
          and (:status is null or r.status = :status)
        order by r.updatedAt desc
    """)
    List<WorkflowRule> search(@Param("query") String query, @Param("status") WorkflowRuleStatus status);
}
