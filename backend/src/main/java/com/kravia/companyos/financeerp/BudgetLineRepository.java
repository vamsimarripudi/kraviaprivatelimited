package com.kravia.companyos.financeerp;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetLineRepository extends JpaRepository<BudgetLine, UUID> {}
