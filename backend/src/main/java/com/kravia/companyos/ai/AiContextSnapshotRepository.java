package com.kravia.companyos.ai;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiContextSnapshotRepository extends JpaRepository<AiContextSnapshot, UUID> {}
