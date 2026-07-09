package com.kravia.companyos.compliance;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ComplianceItemRepository extends JpaRepository<ComplianceItem, UUID> {}
