package com.kravia.companyos.platform;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ModuleFeatureFlagRepository extends JpaRepository<ModuleFeatureFlag, UUID> {
    Optional<ModuleFeatureFlag> findByFlagKey(String flagKey);
    boolean existsByFlagKey(String flagKey);
}
