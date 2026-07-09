package com.kravia.companyos.platformadmin;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PlatformAdminResponses {
    private PlatformAdminResponses() {}

    public record EnvironmentResponse(UUID id, String name, PlatformEnvironmentType environmentType, String url, String version, String buildNumber, Instant deploymentDate, PlatformOperationalStatus status, PlatformHealthState health, String region, Instant updatedAt) {
        static EnvironmentResponse from(PlatformEnvironmentRecord record) {
            return new EnvironmentResponse(record.getId(), record.getName(), record.getEnvironmentType(), record.getUrl(), record.getVersion(), record.getBuildNumber(), record.getDeploymentDate(), record.getStatus(), record.getHealth(), record.getRegion(), record.getUpdatedAt());
        }
    }

    public record ServiceResponse(UUID id, String serviceName, String version, PlatformOperationalStatus status, PlatformHealthState health, String apiBaseUrl, String owner, Instant lastDeployment, String dependencies, Instant updatedAt) {
        static ServiceResponse from(PlatformServiceRecord record) {
            return new ServiceResponse(record.getId(), record.getServiceName(), record.getVersion(), record.getStatus(), record.getHealth(), record.getApiBaseUrl(), record.getOwner(), record.getLastDeployment(), record.getDependencies(), record.getUpdatedAt());
        }
    }

    public record ReleaseResponse(UUID id, String version, String releaseName, LocalDate releaseDate, String modulesIncluded, String breakingChanges, String databaseMigrationVersion, RollbackStatus rollbackStatus, Instant updatedAt) {
        static ReleaseResponse from(PlatformReleaseRecord record) {
            return new ReleaseResponse(record.getId(), record.getVersion(), record.getReleaseName(), record.getReleaseDate(), record.getModulesIncluded(), record.getBreakingChanges(), record.getDatabaseMigrationVersion(), record.getRollbackStatus(), record.getUpdatedAt());
        }
    }

    public record BackupResponse(UUID id, BackupType backupType, Instant lastBackupAt, Instant nextScheduledBackupAt, BackupStatus backupStatus, Long backupSizeBytes, RestoreTestStatus restoreTestStatus, String notes, Instant updatedAt) {
        static BackupResponse from(PlatformBackupRecord record) {
            return new BackupResponse(record.getId(), record.getBackupType(), record.getLastBackupAt(), record.getNextScheduledBackupAt(), record.getBackupStatus(), record.getBackupSizeBytes(), record.getRestoreTestStatus(), record.getNotes(), record.getUpdatedAt());
        }
    }

    public record JobResponse(UUID id, String jobName, String jobType, PlatformJobStatus status, Instant lastRunAt, Instant nextRunAt, String owner, String notes, Instant updatedAt) {
        static JobResponse from(PlatformJobRecord record) {
            return new JobResponse(record.getId(), record.getJobName(), record.getJobType(), record.getStatus(), record.getLastRunAt(), record.getNextRunAt(), record.getOwner(), record.getNotes(), record.getUpdatedAt());
        }
    }

    public record ApiResponse(UUID id, String apiName, String basePath, int endpointCount, String version, boolean authenticationRequired, ApiRegistryStatus status, Integer averageResponseTimeMs, Instant updatedAt) {
        static ApiResponse from(PlatformApiRecord record) {
            return new ApiResponse(record.getId(), record.getApiName(), record.getBasePath(), record.getEndpointCount(), record.getVersion(), record.isAuthenticationRequired(), record.getStatus(), record.getAverageResponseTimeMs(), record.getUpdatedAt());
        }
    }

    public record HealthComponent(String name, PlatformHealthState health, String detail) {}
    public record PlatformMetric(String label, String value) {}
    public record ModuleDependency(String module, List<String> dependsOn) {}

    public record SecurityCenterResponse(long failedLoginAttempts, long lockedAccounts, long activeUsers, List<String> recentSecurityEvents) {}

    public record PlatformOverviewResponse(
        List<PlatformMetric> engineeringMetrics,
        List<HealthComponent> health,
        List<EnvironmentResponse> environments,
        List<ServiceResponse> services,
        List<ReleaseResponse> releases,
        List<BackupResponse> backups,
        List<JobResponse> jobs,
        List<ApiResponse> apis,
        List<ModuleDependency> moduleDependencies,
        SecurityCenterResponse securityCenter
    ) {}
}
