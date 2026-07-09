package com.kravia.companyos.platformadmin;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "platform_service_registry")
public class PlatformServiceRecord extends BaseEntity {
    @Column(nullable = false, length = 160)
    private String serviceName;

    @Column(length = 80)
    private String version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PlatformOperationalStatus status = PlatformOperationalStatus.UNKNOWN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PlatformHealthState health = PlatformHealthState.UNKNOWN;

    @Column(length = 500)
    private String apiBaseUrl;

    @Column(length = 320)
    private String owner;

    private Instant lastDeployment;

    @Column(length = 1000)
    private String dependencies;

    public String getServiceName() { return serviceName; }
    public void setServiceName(String serviceName) { this.serviceName = serviceName; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public PlatformOperationalStatus getStatus() { return status; }
    public void setStatus(PlatformOperationalStatus status) { this.status = status; }
    public PlatformHealthState getHealth() { return health; }
    public void setHealth(PlatformHealthState health) { this.health = health; }
    public String getApiBaseUrl() { return apiBaseUrl; }
    public void setApiBaseUrl(String apiBaseUrl) { this.apiBaseUrl = apiBaseUrl; }
    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }
    public Instant getLastDeployment() { return lastDeployment; }
    public void setLastDeployment(Instant lastDeployment) { this.lastDeployment = lastDeployment; }
    public String getDependencies() { return dependencies; }
    public void setDependencies(String dependencies) { this.dependencies = dependencies; }
}
