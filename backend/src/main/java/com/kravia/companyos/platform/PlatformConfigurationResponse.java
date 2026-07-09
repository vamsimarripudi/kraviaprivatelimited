package com.kravia.companyos.platform;

import java.time.Instant;
import java.util.UUID;

public record PlatformConfigurationResponse(
    UUID id,
    String configKey,
    String configValue,
    String category,
    boolean sensitive,
    Instant updatedAt
) {
    public static PlatformConfigurationResponse from(PlatformConfiguration configuration) {
        return new PlatformConfigurationResponse(
            configuration.getId(),
            configuration.getConfigKey(),
            configuration.isSensitive() ? "********" : configuration.getConfigValue(),
            configuration.getCategory(),
            configuration.isSensitive(),
            configuration.getUpdatedAt()
        );
    }
}
