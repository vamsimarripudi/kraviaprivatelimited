package com.kravia.companyos.contact;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ContactRepository extends JpaRepository<CompanyContact, UUID> {
    @Query("""
        select c from CompanyContact c
        where (:query is null or :query = '' or lower(c.name) like lower(concat('%', :query, '%')) or lower(coalesce(c.organization, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.role, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.email, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.phone, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.notes, '')) like lower(concat('%', :query, '%')))
          and (:category is null or c.category = :category)
          and (:status is null or c.status = :status)
        order by case when c.nextFollowUpDate is null then 1 else 0 end, c.nextFollowUpDate asc, c.updatedAt desc
    """)
    List<CompanyContact> search(
        @Param("query") String query,
        @Param("category") ContactCategory category,
        @Param("status") ContactStatus status
    );
}