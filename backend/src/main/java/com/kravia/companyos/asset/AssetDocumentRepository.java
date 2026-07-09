package com.kravia.companyos.asset;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssetDocumentRepository extends JpaRepository<AssetDocument, UUID> {
    List<AssetDocument> findAllByOrderByCreatedAtDesc();
}