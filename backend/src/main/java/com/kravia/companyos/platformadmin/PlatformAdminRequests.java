package com.kravia.companyos.platformadmin;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;

public final class PlatformAdminRequests {
    private PlatformAdminRequests() {}

    public record EnvironmentRequest(
        @NotBlank @Size(max = 120) String name,
        @NotNull PlatformEnvironmentType environmentType,
        @Size(max = 500) String url,
        @Size(max = 80) String version,
        @Size(max = 120) String buildNumber,
        Instant deploymentDate,
        @NotNull PlatformOperationalStatus status,
        @NotNull PlatformHealthState health,
        @Size(max = 120) String region
    ) {}

    public record ServiceRequest(
        @NotBlank @Size(max = 160) String serviceName,
        @Size(max = 80) String version,
        @NotNull PlatformOperationalStatus status,
        @NotNull PlatformHealthState health,
        @Size(max = 500) String apiBaseUrl,
        @Size(max = 320) String owner,
        Instant lastDeployment,
        @Size(max = 1000) String dependencies
    ) {}

    public record ReleaseRequest(
        @NotBlank @Size(max = 80) String version,
        @NotBlank @Size(max = 200) String releaseName,
        LocalDate releaseDate,
        @Size(max = 2000) String modulesIncluded,
        @Size(max = 3000) String breakingChanges,
        @Size(max = 120) String databaseMigrationVersion,
        @NotNull RollbackStatus rollbackStatus
    ) {}

    public record BackupRequest(
        @NotNull BackupType backupType,
        Instant lastBackupAt,
        Instant nextScheduledBackupAt,
        @NotNull BackupStatus backupStatus,
        @Min(0) Long backupSizeBytes,
        @NotNull RestoreTestStatus restoreTestStatus,
        @Size(max = 2000) String notes
    ) {}

    public record JobRequest(
        @NotBlank @Size(max = 160) String jobName,
        @NotBlank @Size(max = 80) String jobType,
        @NotNull PlatformJobStatus status,
        Instant lastRunAt,
        Instant nextRunAt,
        @Size(max = 320) String owner,
        @Size(max = 2000) String notes
    ) {}

    public record ApiRequest(
        @NotBlank @Size(max = 160) String apiName,
        @NotBlank @Size(max = 300) String basePath,
        @Min(0) int endpointCount,
        @Size(max = 80) String version,
        boolean authenticationRequired,
        @NotNull ApiRegistryStatus status,
        @Min(0) Integer averageResponseTimeMs
    ) {}
}
