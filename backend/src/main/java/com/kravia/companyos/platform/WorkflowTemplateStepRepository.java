package com.kravia.companyos.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowTemplateStepRepository extends JpaRepository<WorkflowTemplateStep, UUID> {
    List<WorkflowTemplateStep> findByTemplateIdAndArchivedAtIsNullOrderByStepOrderAsc(UUID templateId);
    long countByTemplateIdAndArchivedAtIsNull(UUID templateId);
}
