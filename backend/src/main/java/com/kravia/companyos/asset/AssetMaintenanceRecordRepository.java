package com.kravia.companyos.asset;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetMaintenanceRecordRepository extends JpaRepository<AssetMaintenanceRecord, UUID> {
    List<AssetMaintenanceRecord> findAllByOrderByMaintenanceDateDescCreatedAtDesc();
}