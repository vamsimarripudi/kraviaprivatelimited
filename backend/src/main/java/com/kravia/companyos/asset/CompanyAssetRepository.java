package com.kravia.companyos.asset;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanyAssetRepository extends JpaRepository<CompanyAsset, UUID> {
    boolean existsByAssetCodeIgnoreCase(String assetCode);
    List<CompanyAsset> findAllByOrderByAssetNameAsc();
}