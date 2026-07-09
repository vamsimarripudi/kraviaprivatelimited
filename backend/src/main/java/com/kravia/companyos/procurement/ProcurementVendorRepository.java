package com.kravia.companyos.procurement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcurementVendorRepository extends JpaRepository<ProcurementVendor, UUID> {
    List<ProcurementVendor> findAllByOrderByVendorNameAsc();
}
