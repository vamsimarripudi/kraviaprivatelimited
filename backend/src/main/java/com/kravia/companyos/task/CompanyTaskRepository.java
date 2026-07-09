package com.kravia.companyos.task;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyTaskRepository extends JpaRepository<CompanyTask, UUID> {}
