package com.kravia.companyos.platform;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PlatformModuleRepository extends JpaRepository<PlatformModule, UUID> {
    Optional<PlatformModule> findByCode(String code);
    boolean existsByCode(String code);
}
