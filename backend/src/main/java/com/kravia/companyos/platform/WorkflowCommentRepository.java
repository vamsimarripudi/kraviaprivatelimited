package com.kravia.companyos.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowCommentRepository extends JpaRepository<WorkflowComment, UUID> {
    List<WorkflowComment> findByWorkflowIdOrderByCreatedAtAsc(UUID workflowId);
}
