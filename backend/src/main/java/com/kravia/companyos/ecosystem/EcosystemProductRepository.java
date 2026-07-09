package com.kravia.companyos.ecosystem;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EcosystemProductRepository extends JpaRepository<EcosystemProduct, UUID> {
    Optional<EcosystemProduct> findByProductCodeIgnoreCase(String productCode);

    @Query("""
        select p from EcosystemProduct p
        where (:query is null or :query = '' or lower(p.productName) like lower(concat('%', :query, '%')) or lower(p.productCode) like lower(concat('%', :query, '%')) or lower(p.owner) like lower(concat('%', :query, '%')) or lower(coalesce(p.description, '')) like lower(concat('%', :query, '%')) or lower(coalesce(p.domain, '')) like lower(concat('%', :query, '%')) or lower(coalesce(p.riskRegister, '')) like lower(concat('%', :query, '%')))
          and (:status is null or p.status = :status)
          and (:owner is null or :owner = '' or lower(p.owner) like lower(concat('%', :owner, '%')))
        order by p.updatedAt desc
    """)
    List<EcosystemProduct> search(
        @Param("query") String query,
        @Param("status") EcosystemProductStatus status,
        @Param("owner") String owner
    );
}
