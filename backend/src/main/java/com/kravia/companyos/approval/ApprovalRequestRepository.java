package com.kravia.companyos.approval;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApprovalRequestRepository extends JpaRepository<ApprovalRequestEntity, UUID> {
    long countByStatusAndArchivedAtIsNull(ApprovalStatus status);

    @Query("""
        select a from ApprovalRequestEntity a
        where a.archivedAt is null
          and (:query is null or :query = '' or lower(a.title) like lower(concat('%', :query, '%')) or lower(coalesce(a.description, '')) like lower(concat('%', :query, '%')))
          and (:status is null or a.status = :status)
          and (:linkedModule is null or :linkedModule = '' or a.linkedModule = :linkedModule)
        order by a.updatedAt desc
    """)
    List<ApprovalRequestEntity> search(@Param("query") String query, @Param("status") ApprovalStatus status, @Param("linkedModule") String linkedModule);
}
