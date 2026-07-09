package com.kravia.companyos.platform;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ModuleRegistryService {
    private static final String MODULE = "ERP_MODULE_REGISTRY";

    private final PlatformModuleRepository modules;
    private final ModuleFeatureFlagRepository featureFlags;
    private final PermissionService permissions;
    private final AuditService auditService;

    public ModuleRegistryService(PlatformModuleRepository modules, ModuleFeatureFlagRepository featureFlags, PermissionService permissions, AuditService auditService) {
        this.modules = modules;
        this.featureFlags = featureFlags;
        this.permissions = permissions;
        this.auditService = auditService;
    }

    @Transactional
    public List<ModuleRegistryResponse> list(AppUser actor) {
        requireViewer(actor);
        ensureDefaults();
        return modules.findAll().stream()
            .sorted(Comparator.comparing(PlatformModule::getName))
            .map(module -> ModuleRegistryResponse.from(module, isFeatureEnabled(module.getFeatureFlagKey())))
            .toList();
    }

    @Transactional
    public ModuleRegistryResponse update(String code, ModuleRegistryUpdateRequest request, AppUser actor) {
        permissions.requireAnyRole(actor, Role.FOUNDER);
        ensureDefaults();
        PlatformModule module = modules.findByCode(code).orElseThrow(() -> new NotFoundException("Module not found."));
        if (request.status() != null) module.setStatus(request.status());
        if (request.navigationPath() != null) module.setNavigationPath(blankToNull(request.navigationPath()));
        if (request.featureEnabled() != null && module.getFeatureFlagKey() != null) {
            ModuleFeatureFlag flag = featureFlags.findByFlagKey(module.getFeatureFlagKey()).orElseGet(() -> newFlag(module.getFeatureFlagKey(), module.getName()));
            flag.setEnabled(request.featureEnabled());
            featureFlags.save(flag);
        }
        PlatformModule saved = modules.saveAndFlush(module);
        auditService.record(actor, MODULE, "MODULE_UPDATED", "Updated platform module " + saved.getCode(), "IMPORTANT");
        return ModuleRegistryResponse.from(saved, isFeatureEnabled(saved.getFeatureFlagKey()));
    }

    private void ensureDefaults() {
        for (ModuleSeed seed : defaultModules()) {
            if (!modules.existsByCode(seed.code())) {
                PlatformModule module = new PlatformModule();
                module.setCode(seed.code());
                module.setName(seed.name());
                module.setVersion(seed.version());
                module.setStatus(seed.status());
                module.setNavigationPath(seed.navigationPath());
                module.setPermissions(seed.permissions());
                module.setDependencies(seed.dependencies());
                module.setFeatureFlagKey(seed.featureFlagKey());
                modules.save(module);
            }
            if (seed.featureFlagKey() != null && !featureFlags.existsByFlagKey(seed.featureFlagKey())) {
                ModuleFeatureFlag flag = newFlag(seed.featureFlagKey(), seed.name());
                flag.setEnabled(seed.status() == PlatformModuleStatus.ACTIVE);
                featureFlags.save(flag);
            }
        }
    }

    private ModuleFeatureFlag newFlag(String key, String moduleName) {
        ModuleFeatureFlag flag = new ModuleFeatureFlag();
        flag.setFlagKey(key);
        flag.setDescription("Controls availability for " + moduleName + ".");
        return flag;
    }

    private boolean isFeatureEnabled(String key) {
        if (key == null || key.isBlank()) return true;
        return featureFlags.findByFlagKey(key).map(ModuleFeatureFlag::isEnabled).orElse(false);
    }

    private List<ModuleSeed> defaultModules() {
        String allRead = "FOUNDER:READ,CREATE,UPDATE,DELETE;DIRECTOR:READ,CREATE,UPDATE;VIEWER:READ";
        return List.of(
            seed("AUTH", "Authentication", "/login", "FOUNDER:READ;DIRECTOR:READ;VIEWER:READ", null, PlatformModuleStatus.ACTIVE),
            seed("COMPANY_PROFILE", "Company Profile", "/company-profile", allRead, null, PlatformModuleStatus.ACTIVE),
            seed("DOCUMENTS", "Document Vault", "/documents", "FOUNDER:READ,CREATE,UPDATE,DELETE,DOWNLOAD;DIRECTOR:READ,CREATE,UPDATE,DOWNLOAD;VIEWER:READ,DOWNLOAD", null, PlatformModuleStatus.ACTIVE),
            seed("BOARD_MEETINGS", "Board Meetings", "/board-meetings", allRead, "DOCUMENTS;TASKS", PlatformModuleStatus.ACTIVE),
            seed("FINANCE", "Financial Records", "/finance", allRead, "BOARD_MEETINGS;DOCUMENTS", PlatformModuleStatus.ACTIVE),
            seed("COMPLIANCE", "Compliance Center", "/compliance", allRead, "DOCUMENTS;CONTACTS;TASKS", PlatformModuleStatus.ACTIVE),
            seed("TASKS", "Company Tasks", "/tasks", allRead, "DOCUMENTS", PlatformModuleStatus.ACTIVE),
            seed("PRODUCTS", "Products Portfolio", "/products", allRead, "TASKS", PlatformModuleStatus.ACTIVE),
            seed("CONTACTS", "Contacts & Partners", "/contacts", allRead, "DOCUMENTS;TASKS", PlatformModuleStatus.ACTIVE),
            seed("ANNOUNCEMENTS", "Announcements", "/announcements", "FOUNDER:READ,CREATE,UPDATE,DELETE;DIRECTOR:READ,CREATE,UPDATE;VIEWER:READ", "DOCUMENTS;NOTIFICATIONS", PlatformModuleStatus.ACTIVE),
            seed("NOTIFICATIONS", "Notifications", "/notifications", "FOUNDER:READ,UPDATE,DELETE;DIRECTOR:READ,UPDATE,DELETE;VIEWER:READ,UPDATE,DELETE", null, PlatformModuleStatus.ACTIVE),
            seed("REPORTS", "Reports", "/reports", "FOUNDER:READ,CREATE;DIRECTOR:READ,CREATE;VIEWER:READ", null, PlatformModuleStatus.ACTIVE),
            seed("SEARCH", "Global Search", "/search", "FOUNDER:READ;DIRECTOR:READ;VIEWER:READ", null, PlatformModuleStatus.ACTIVE),
            seed("AI_ASSISTANT", "Executive AI Assistant", "/ai-assistant", "FOUNDER:READ,CREATE,DELETE;DIRECTOR:READ,CREATE,DELETE", "SEARCH;REPORTS", PlatformModuleStatus.ACTIVE),
            seed("AUDIT_LOGS", "Audit Logs", "/audit-logs", "FOUNDER:READ;DIRECTOR:READ", null, PlatformModuleStatus.ACTIVE),
            seed("SETTINGS", "Settings", "/settings", "FOUNDER:READ,CREATE,UPDATE,DELETE", null, PlatformModuleStatus.PLANNED)
        );
    }

    private ModuleSeed seed(String code, String name, String navigationPath, String permissions, String dependencies, PlatformModuleStatus status) {
        return new ModuleSeed(code, name, "1.0.0", status, navigationPath, permissions, dependencies, "module." + code.toLowerCase() + ".enabled");
    }

    private void requireViewer(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR, Role.VIEWER); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private record ModuleSeed(
        String code,
        String name,
        String version,
        PlatformModuleStatus status,
        String navigationPath,
        String permissions,
        String dependencies,
        String featureFlagKey
    ) {}
}
