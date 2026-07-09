package com.kravia.companyos.sales;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SalesCustomerRepository extends JpaRepository<SalesCustomer, UUID> {
    @Query("""
        select c from SalesCustomer c
        where (:query is null or :query = '' or lower(c.customerName) like lower(concat('%', :query, '%')) or lower(coalesce(c.organizationType, '')) like lower(concat('%', :query, '%')) or lower(c.product) like lower(concat('%', :query, '%')) or lower(coalesce(c.plan, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.subscriptionStatus, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.paymentStatus, '')) like lower(concat('%', :query, '%')) or lower(coalesce(c.onboardingStatus, '')) like lower(concat('%', :query, '%')))
          and (:product is null or :product = '' or lower(c.product) like lower(concat('%', :product, '%')))
          and (:subscriptionStatus is null or :subscriptionStatus = '' or lower(coalesce(c.subscriptionStatus, '')) like lower(concat('%', :subscriptionStatus, '%')))
        order by c.updatedAt desc
    """)
    List<SalesCustomer> search(
        @Param("query") String query,
        @Param("product") String product,
        @Param("subscriptionStatus") String subscriptionStatus
    );
}
