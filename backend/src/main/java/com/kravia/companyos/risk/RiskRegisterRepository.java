package com.kravia.companyos.risk;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RiskRegisterRepository extends JpaRepository<RiskRegisterEntry, UUID> {
    long countBySeverityAndArchivedAtIsNull(RiskLevel severity);
    long countByStatusAndArchivedAtIsNull(RiskStatus status);

    @Query("""
        select r from RiskRegisterEntry r
        where r.archivedAt is null
          and (:query is null or :query = '' or lower(r.title) like lower(concat('%', :query, '%')) or lower(coalesce(r.description, '')) like lower(concat('%', :query, '%')) or lower(coalesce(r.owner, '')) like lower(concat('%', :query, '%')))
          and (:category is null or r.category = :category)
          and (:severity is null or r.severity = :severity)
          and (:status is null or r.status = :status)
        order by r.reviewDate asc, r.updatedAt desc
    """)
    List<RiskRegisterEntry> search(@Param("query") String query, @Param("category") RiskCategory category, @Param("severity") RiskLevel severity, @Param("status") RiskStatus status);
}
