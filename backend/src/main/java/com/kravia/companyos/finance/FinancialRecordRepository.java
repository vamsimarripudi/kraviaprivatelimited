package com.kravia.companyos.finance;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface FinancialRecordRepository extends JpaRepository<FinancialRecord, UUID> {
    @Query("""
        select f from FinancialRecord f
        where (:query is null or :query = '' or lower(f.reportingMonth) like lower(concat('%', :query, '%')) or lower(coalesce(f.founderNotes, '')) like lower(concat('%', :query, '%')) or lower(f.createdBy) like lower(concat('%', :query, '%')))
          and (:reportingYear is null or substring(f.reportingMonth, 1, 4) = :reportingYear)
          and (:reportingMonth is null or substring(f.reportingMonth, 6, 2) = :reportingMonth)
        order by f.reportingMonth desc, f.updatedAt desc
    """)
    List<FinancialRecord> search(@Param("query") String query, @Param("reportingYear") String reportingYear, @Param("reportingMonth") String reportingMonth);
}
