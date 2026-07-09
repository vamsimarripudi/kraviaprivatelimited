package com.kravia.companyos.document;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DocumentRepository extends JpaRepository<DocumentRecord, UUID> {
    @Query("""
        select d from DocumentRecord d
        where (:query is null or :query = '' or lower(d.title) like lower(concat('%', :query, '%')) or lower(coalesce(d.description, '')) like lower(concat('%', :query, '%')) or lower(d.fileName) like lower(concat('%', :query, '%')))
          and (:category is null or d.category = :category)
          and (:status is null or d.status = :status)
        order by d.updatedAt desc
    """)
    List<DocumentRecord> search(@Param("query") String query, @Param("category") DocumentCategory category, @Param("status") DocumentStatus status);
}
