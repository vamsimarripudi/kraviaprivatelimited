package com.kravia.companyos.platform;

import com.kravia.companyos.platform.WorkflowAutomationEnums.ScheduledJobStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ScheduledJobRepository extends JpaRepository<ScheduledJob, UUID> {
    long countByStatusAndArchivedAtIsNull(ScheduledJobStatus status);

    @Query("""
        select j from ScheduledJob j
        where j.archivedAt is null
          and (:query is null or :query = '' or lower(j.jobName) like lower(concat('%', :query, '%')) or lower(j.jobKey) like lower(concat('%', :query, '%')))
          and (:status is null or j.status = :status)
        order by j.updatedAt desc
    """)
    List<ScheduledJob> search(@Param("query") String query, @Param("status") ScheduledJobStatus status);
}
