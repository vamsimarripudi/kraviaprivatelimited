package com.kravia.companyos.legal;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LegalRiskLinkRepository extends JpaRepository<LegalRiskLink, UUID> {
    List<LegalRiskLink> findAllByOrderByUpdatedAtDesc();
}
