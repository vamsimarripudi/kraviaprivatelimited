package com.kravia.companyos.platformadmin;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformEnvironmentRepository extends JpaRepository<PlatformEnvironmentRecord, UUID> {
    List<PlatformEnvironmentRecord> findAllByOrderByEnvironmentTypeAscNameAsc();
}
