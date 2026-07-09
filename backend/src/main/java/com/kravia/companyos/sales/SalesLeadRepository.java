package com.kravia.companyos.sales;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalesLeadRepository extends JpaRepository<SalesLead, UUID> {
    @Query("""
        select l from SalesLead l
        where (:query is null or :query = '' or lower(l.leadName) like lower(concat('%', :query, '%')) or lower(l.organizationName) like lower(concat('%', :query, '%')) or lower(coalesce(l.contactPerson, '')) like lower(concat('%', :query, '%')) or lower(coalesce(l.email, '')) like lower(concat('%', :query, '%')) or lower(coalesce(l.phone, '')) like lower(concat('%', :query, '%')) or lower(l.productInterest) like lower(concat('%', :query, '%')) or lower(coalesce(l.leadSource, '')) like lower(concat('%', :query, '%')) or lower(coalesce(l.assignedPerson, '')) like lower(concat('%', :query, '%')))
          and (:stage is null or l.stage = :stage)
          and (:priority is null or l.priority = :priority)
        order by case when l.nextFollowUpDate is null then 1 else 0 end, l.nextFollowUpDate asc, l.updatedAt desc
    """)
    List<SalesLead> search(
        @Param("query") String query,
        @Param("stage") LeadStage stage,
        @Param("priority") LeadPriority priority
    );
}
