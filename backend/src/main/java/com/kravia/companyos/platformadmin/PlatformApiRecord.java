package com.kravia.companyos.platformadmin;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "platform_api_registry")
public class PlatformApiRecord extends BaseEntity {
    @Column(nullable = false, length = 160)
    private String apiName;

    @Column(nullable = false, length = 300)
    private String basePath;

    @Column(nullable = false)
    private int endpointCount;

    @Column(length = 80)
    private String version;

    @Column(nullable = false)
    private boolean authenticationRequired = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private ApiRegistryStatus status = ApiRegistryStatus.UNKNOWN;

    private Integer averageResponseTimeMs;

    public String getApiName() { return apiName; }
    public void setApiName(String apiName) { this.apiName = apiName; }
    public String getBasePath() { return basePath; }
    public void setBasePath(String basePath) { this.basePath = basePath; }
    public int getEndpointCount() { return endpointCount; }
    public void setEndpointCount(int endpointCount) { this.endpointCount = endpointCount; }
    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public boolean isAuthenticationRequired() { return authenticationRequired; }
    public void setAuthenticationRequired(boolean authenticationRequired) { this.authenticationRequired = authenticationRequired; }
    public ApiRegistryStatus getStatus() { return status; }
    public void setStatus(ApiRegistryStatus status) { this.status = status; }
    public Integer getAverageResponseTimeMs() { return averageResponseTimeMs; }
    public void setAverageResponseTimeMs(Integer averageResponseTimeMs) { this.averageResponseTimeMs = averageResponseTimeMs; }
}
