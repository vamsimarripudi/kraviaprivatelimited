package com.kravia.companyos.platform;

import com.kravia.companyos.platform.WorkflowAutomationEnums.WorkflowTemplateStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkflowTemplateRepository extends JpaRepository<WorkflowTemplate, UUID> {
    long countByStatusAndArchivedAtIsNull(WorkflowTemplateStatus status);

    @Query("""
        select t from WorkflowTemplate t
        where t.archivedAt is null
          and (:query is null or :query = '' or lower(t.templateName) like lower(concat('%', :query, '%')) or lower(coalesce(t.description, '')) like lower(concat('%', :query, '%')))
          and (:status is null or t.status = :status)
          and (:workflowType is null or t.workflowType = :workflowType)
        order by t.updatedAt desc
    """)
    List<WorkflowTemplate> search(@Param("query") String query, @Param("status") WorkflowTemplateStatus status, @Param("workflowType") WorkflowType workflowType);
}
