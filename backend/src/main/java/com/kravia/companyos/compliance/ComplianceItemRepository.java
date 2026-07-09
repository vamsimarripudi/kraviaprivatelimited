package com.kravia.companyos.compliance;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ComplianceItemRepository extends JpaRepository<ComplianceItem, UUID> {
    @Query("""
        select c from ComplianceItem c
        where (:query is null or :query = '' or lower(c.title) like lower(concat('%', :query, '%')) or lower(coalesce(c.description, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.notes, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.responsiblePerson, '')) like lower(concat('%', :query, '%')))
          and (:category is null or c.category = :category)
          and (:status is null or c.status = :status)
          and (:priority is null or c.priority = :priority)
        order by case when c.dueDate is null then 1 else 0 end, c.dueDate asc, c.updatedAt desc
    """)
    List<ComplianceItem> search(
        @Param("query") String query,
        @Param("category") ComplianceCategory category,
        @Param("status") ComplianceStatus status,
        @Param("priority") CompliancePriority priority
    );
}
