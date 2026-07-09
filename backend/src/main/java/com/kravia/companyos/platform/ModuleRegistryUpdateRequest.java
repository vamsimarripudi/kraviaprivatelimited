package com.kravia.companyos.platform;

public record ModuleRegistryUpdateRequest(
    PlatformModuleStatus status,
    String navigationPath,
    Boolean featureEnabled
) {}
