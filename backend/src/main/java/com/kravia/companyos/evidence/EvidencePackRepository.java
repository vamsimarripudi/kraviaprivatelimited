package com.kravia.companyos.evidence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvidencePackRepository extends JpaRepository<EvidencePack, UUID> {
    long countByStatusAndArchivedAtIsNull(EvidencePackStatus status);
    List<EvidencePack> findByArchivedAtIsNullOrderByGeneratedAtDesc();
}
