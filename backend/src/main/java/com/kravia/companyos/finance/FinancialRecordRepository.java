package com.kravia.companyos.finance;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinancialRecordRepository extends JpaRepository<FinancialRecord, UUID> {}
