package com.kravia.companyos.procurement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {
    boolean existsByPoNumberIgnoreCase(String poNumber);
    List<PurchaseOrder> findAllByOrderByIssueDateDescCreatedAtDesc();
}
