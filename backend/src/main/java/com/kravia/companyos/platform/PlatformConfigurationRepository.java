package com.kravia.companyos.platform;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformConfigurationRepository extends JpaRepository<PlatformConfiguration, UUID> {
    Optional<PlatformConfiguration> findByConfigKey(String configKey);
    List<PlatformConfiguration> findByCategoryIgnoreCaseOrderByConfigKeyAsc(String category);
}
