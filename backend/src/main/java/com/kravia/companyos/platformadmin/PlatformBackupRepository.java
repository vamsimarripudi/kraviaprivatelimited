package com.kravia.companyos.platformadmin;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformBackupRepository extends JpaRepository<PlatformBackupRecord, UUID> {
    List<PlatformBackupRecord> findAllByOrderByBackupTypeAscUpdatedAtDesc();
}
