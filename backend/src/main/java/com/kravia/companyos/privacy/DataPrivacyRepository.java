package com.kravia.companyos.privacy;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DataPrivacyRepository extends JpaRepository<DataPrivacyRecord, UUID> {
    long countByClassificationAndArchivedAtIsNull(DataClassification classification);
    long countBySensitiveDocumentTrueAndArchivedAtIsNull();

    @Query("""
        select p from DataPrivacyRecord p
        where p.archivedAt is null
          and (:moduleName is null or :moduleName = '' or p.moduleName = :moduleName)
          and (:classification is null or p.classification = :classification)
        order by p.updatedAt desc
    """)
    List<DataPrivacyRecord> search(@Param("moduleName") String moduleName, @Param("classification") DataClassification classification);
}
