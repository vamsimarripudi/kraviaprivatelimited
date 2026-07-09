package com.kravia.companyos.governance;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessReviewRepository extends JpaRepository<AccessReviewRecord, UUID> {
    Optional<AccessReviewRecord> findByUserIdAndQuarterLabel(UUID userId, String quarterLabel);
    List<AccessReviewRecord> findByQuarterLabel(String quarterLabel);
    long countByQuarterLabelAndReviewStatus(String quarterLabel, AccessReviewStatus reviewStatus);
}
