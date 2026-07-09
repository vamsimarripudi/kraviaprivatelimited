package com.kravia.companyos.procurement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VendorBillRepository extends JpaRepository<VendorBill, UUID> {
    List<VendorBill> findAllByOrderByDueDateAscCreatedAtDesc();
}
