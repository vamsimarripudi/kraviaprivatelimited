package com.kravia.companyos.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CrossModuleLinkRepository extends JpaRepository<CrossModuleLink, UUID> {
    @Query("""
        select l from CrossModuleLink l
        where (:module is null or :module = '' or l.sourceModule = :module or l.targetModule = :module)
          and (:recordId is null or l.sourceRecordId = :recordId or l.targetRecordId = :recordId)
        order by l.updatedAt desc
    """)
    List<CrossModuleLink> findRelated(@Param("module") String module, @Param("recordId") UUID recordId);
}
