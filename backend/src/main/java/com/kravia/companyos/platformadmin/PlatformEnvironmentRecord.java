package com.kravia.companyos.platformadmin;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "platform_environments")
public class PlatformEnvironmentRecord extends BaseEntity {
    @Column(nullable = false, length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PlatformEnvironmentType environmentType;

    @Column(length = 500)
    private String url;

    @Column(length = 80)
    private String version;

    @Column(length = 120)
    private String buildNumber;

    private Instant deploymentDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PlatformOperationalStatus status = PlatformOperationalStatus.UNKNOWN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private PlatformHealthState health = PlatformHealthState.UNKNOWN;

    @Column(length = 120)
    private String region;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public PlatformEnvironmentType getEnvironmentType() { return environmentType; }
    public void setEnvironmentType(PlatformEnvironmentType environmentType) { this.environmentType = environmentType; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public String getBuildNumber() { return buildNumber; }
    public void setBuildNumber(String buildNumber) { this.buildNumber = buildNumber; }
    public Instant getDeploymentDate() { return deploymentDate; }
    public void setDeploymentDate(Instant deploymentDate) { this.deploymentDate = deploymentDate; }
    public PlatformOperationalStatus getStatus() { return status; }
    public void setStatus(PlatformOperationalStatus status) { this.status = status; }
    public PlatformHealthState getHealth() { return health; }
    public void setHealth(PlatformHealthState health) { this.health = health; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
}
