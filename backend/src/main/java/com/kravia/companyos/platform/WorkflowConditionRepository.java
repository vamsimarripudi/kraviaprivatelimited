package com.kravia.companyos.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowConditionRepository extends JpaRepository<WorkflowCondition, UUID> {
    List<WorkflowCondition> findByTemplateIdAndArchivedAtIsNullOrderByCreatedAtAsc(UUID templateId);
    List<WorkflowCondition> findByRuleIdAndArchivedAtIsNullOrderByCreatedAtAsc(UUID ruleId);
}
