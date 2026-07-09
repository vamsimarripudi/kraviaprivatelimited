package com.kravia.companyos.product;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<CompanyProduct, UUID> {
    @Query("""
        select p from CompanyProduct p
        where (:query is null or :query = '' or lower(p.name) like lower(concat('%', :query, '%')) or lower(coalesce(p.description, '')) like lower(concat('%', :query, '%')) or lower(coalesce(p.keyFeatures, '')) like lower(concat('%', :query, '%')) or lower(coalesce(p.pendingWork, '')) like lower(concat('%', :query, '%')) or lower(coalesce(p.risks, '')) like lower(concat('%', :query, '%')) or lower(coalesce(p.nextMilestone, '')) like lower(concat('%', :query, '%')) or lower(coalesce(p.responsiblePerson, '')) like lower(concat('%', :query, '%')))
          and (:status is null or p.status = :status)
          and (:developmentStage is null or :developmentStage = '' or lower(p.developmentStage) like lower(concat('%', :developmentStage, '%')))
        order by p.updatedAt desc
    """)
    List<CompanyProduct> search(
        @Param("query") String query,
        @Param("status") ProductStatus status,
        @Param("developmentStage") String developmentStage
    );
}