package com.kravia.companyos.platform;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ModuleRegistryResponse(
    UUID id,
    String code,
    String name,
    String version,
    PlatformModuleStatus status,
    String navigationPath,
    List<String> permissions,
    List<String> dependencies,
    String featureFlagKey,
    boolean featureEnabled,
    Instant updatedAt
) {
    public static ModuleRegistryResponse from(PlatformModule module, boolean featureEnabled) {
        return new ModuleRegistryResponse(
            module.getId(),
            module.getCode(),
            module.getName(),
            module.getVersion(),
            module.getStatus(),
            module.getNavigationPath(),
            split(module.getPermissions()),
            split(module.getDependencies()),
            module.getFeatureFlagKey(),
            featureEnabled,
            module.getUpdatedAt()
        );
    }

    private static List<String> split(String value) {
        if (value == null || value.isBlank()) return List.of();
        return List.of(value.split(";")).stream().map(String::trim).filter(item -> !item.isBlank()).toList();
    }
}
