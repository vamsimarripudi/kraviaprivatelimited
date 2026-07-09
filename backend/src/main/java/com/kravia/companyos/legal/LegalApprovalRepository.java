package com.kravia.companyos.legal;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LegalApprovalRepository extends JpaRepository<LegalApproval, UUID> {
    List<LegalApproval> findAllByOrderByUpdatedAtDesc();
}
