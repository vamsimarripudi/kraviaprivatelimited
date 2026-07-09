package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "platform_modules")
public class PlatformModule extends BaseEntity {
    @Column(nullable = false, unique = true, length = 80)
    private String code;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(nullable = false, length = 40)
    private String version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PlatformModuleStatus status = PlatformModuleStatus.ACTIVE;

    @Column(length = 240)
    private String navigationPath;

    @Column(nullable = false, length = 500)
    private String permissions;

    @Column(length = 500)
    private String dependencies;

    @Column(length = 120)
    private String featureFlagKey;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public PlatformModuleStatus getStatus() { return status; }
    public void setStatus(PlatformModuleStatus status) { this.status = status; }
    public String getNavigationPath() { return navigationPath; }
    public void setNavigationPath(String navigationPath) { this.navigationPath = navigationPath; }
    public String getPermissions() { return permissions; }
    public void setPermissions(String permissions) { this.permissions = permissions; }
    public String getDependencies() { return dependencies; }
    public void setDependencies(String dependencies) { this.dependencies = dependencies; }
    public String getFeatureFlagKey() { return featureFlagKey; }
    public void setFeatureFlagKey(String featureFlagKey) { this.featureFlagKey = featureFlagKey; }
}
