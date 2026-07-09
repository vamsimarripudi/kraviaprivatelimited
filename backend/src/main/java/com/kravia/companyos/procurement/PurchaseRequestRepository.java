package com.kravia.companyos.procurement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseRequestRepository extends JpaRepository<PurchaseRequest, UUID> {
    List<PurchaseRequest> findAllByOrderByRequiredDateAscCreatedAtDesc();
}
