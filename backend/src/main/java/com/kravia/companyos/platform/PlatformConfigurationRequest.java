package com.kravia.companyos.platform;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PlatformConfigurationRequest(
    @NotBlank(message = "Configuration key is required.")
    @Size(max = 160, message = "Configuration key is too long.")
    String configKey,

    @Size(max = 3000, message = "Configuration value is too long.")
    String configValue,

    @NotBlank(message = "Configuration category is required.")
    @Size(max = 80, message = "Configuration category is too long.")
    String category,

    boolean sensitive
) {}
