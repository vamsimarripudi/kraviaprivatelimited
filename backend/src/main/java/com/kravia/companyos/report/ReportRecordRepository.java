package com.kravia.companyos.report;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRecordRepository extends JpaRepository<ReportRecord, UUID> {}
