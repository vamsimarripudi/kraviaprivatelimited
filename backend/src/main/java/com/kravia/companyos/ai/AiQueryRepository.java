package com.kravia.companyos.ai;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiQueryRepository extends JpaRepository<AiQuery, UUID> {
    List<AiQuery> findByArchivedAtIsNullOrderByCreatedAtDesc();
    List<AiQuery> findByActorEmailIgnoreCaseAndArchivedAtIsNullOrderByCreatedAtDesc(String actorEmail);
}
