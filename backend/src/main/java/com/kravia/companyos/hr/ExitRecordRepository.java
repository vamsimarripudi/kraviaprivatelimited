package com.kravia.companyos.hr;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExitRecordRepository extends JpaRepository<ExitRecord, UUID> {
    List<ExitRecord> findAllByOrderByLastWorkingDayDescCreatedAtDesc();
}
