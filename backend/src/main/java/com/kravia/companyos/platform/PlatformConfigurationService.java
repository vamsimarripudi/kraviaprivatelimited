package com.kravia.companyos.platform;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformConfigurationService {
    private static final String MODULE = "ERP_CONFIGURATION";

    private final PlatformConfigurationRepository configurations;
    private final PermissionService permissions;
    private final AuditService auditService;

    public PlatformConfigurationService(PlatformConfigurationRepository configurations, PermissionService permissions, AuditService auditService) {
        this.configurations = configurations;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<PlatformConfigurationResponse> list(String category, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
        List<PlatformConfiguration> records = category == null || category.isBlank()
            ? configurations.findAll()
            : configurations.findByCategoryIgnoreCaseOrderByConfigKeyAsc(category.trim());
        return records.stream()
            .sorted(Comparator.comparing(PlatformConfiguration::getCategory).thenComparing(PlatformConfiguration::getConfigKey))
            .map(PlatformConfigurationResponse::from)
            .toList();
    }

    @Transactional
    public PlatformConfigurationResponse upsert(PlatformConfigurationRequest request, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        PlatformConfiguration configuration = configurations.findByConfigKey(request.configKey().trim()).orElseGet(PlatformConfiguration::new);
        configuration.setConfigKey(request.configKey().trim());
        configuration.setConfigValue(blankToNull(request.configValue()));
        configuration.setCategory(request.category().trim().toUpperCase());
        configuration.setSensitive(request.sensitive());
        PlatformConfiguration saved = configurations.saveAndFlush(configuration);
        auditService.record(actor, MODULE, "CONFIGURATION_UPDATED", "Updated platform configuration " + saved.getConfigKey(), "WARNING");
        return PlatformConfigurationResponse.from(saved);
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
