package com.kravia.companyos.platformadmin;

import com.kravia.companyos.approval.ApprovalRequestRepository;
import com.kravia.companyos.approval.ApprovalStatus;
import com.kravia.companyos.audit.AuditLogRepository;
import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.platform.PlatformModuleRepository;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.task.CompanyTaskRepository;
import com.kravia.companyos.task.TaskStatus;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformAdminService {
    private static final String MODULE = "PLATFORM_ADMIN";

    private final PlatformEnvironmentRepository environments;
    private final PlatformServiceRegistryRepository services;
    private final PlatformReleaseRepository releases;
    private final PlatformBackupRepository backups;
    private final PlatformJobRepository jobs;
    private final PlatformApiRegistryRepository apis;
    private final PlatformModuleRepository modules;
    private final CompanyTaskRepository tasks;
    private final ApprovalRequestRepository approvals;
    private final UserRepository users;
    private final AuditLogRepository auditLogs;
    private final PermissionService permissions;
    private final AuditService auditService;
    private final DataSource dataSource;
    private final Flyway flyway;
    private final Path storageRoot;
    private final String applicationVersion;
    private final String buildVersion;

    public PlatformAdminService(
        PlatformEnvironmentRepository environments,
        PlatformServiceRegistryRepository services,
        PlatformReleaseRepository releases,
        PlatformBackupRepository backups,
        PlatformJobRepository jobs,
        PlatformApiRegistryRepository apis,
        PlatformModuleRepository modules,
        CompanyTaskRepository tasks,
        ApprovalRequestRepository approvals,
        UserRepository users,
        AuditLogRepository auditLogs,
        PermissionService permissions,
        AuditService auditService,
        DataSource dataSource,
        Flyway flyway,
        @Value("${kravia.documents.storage-root}") String storageRoot,
        @Value("${kravia.platform.version:0.1.0}") String applicationVersion,
        @Value("${kravia.platform.build-version:No information has been added yet.}") String buildVersion
    ) {
        this.environments = environments;
        this.services = services;
        this.releases = releases;
        this.backups = backups;
        this.jobs = jobs;
        this.apis = apis;
        this.modules = modules;
        this.tasks = tasks;
        this.approvals = approvals;
        this.users = users;
        this.auditLogs = auditLogs;
        this.permissions = permissions;
        this.auditService = auditService;
        this.dataSource = dataSource;
        this.flyway = flyway;
        this.storageRoot = Path.of(storageRoot).toAbsolutePath().normalize();
        this.applicationVersion = applicationVersion;
        this.buildVersion = buildVersion;
    }

    @Transactional(readOnly = true)
    public PlatformAdminResponses.PlatformOverviewResponse overview(AppUser actor) {
        requireReader(actor);
        return new PlatformAdminResponses.PlatformOverviewResponse(
            engineeringMetrics(),
            health(),
            listEnvironments(actor),
            listServices(actor),
            listReleases(actor),
            listBackups(actor),
            listJobs(actor),
            listApis(actor),
            moduleDependencies(),
            securityCenter()
        );
    }

    @Transactional(readOnly = true)
    public List<PlatformAdminResponses.EnvironmentResponse> listEnvironments(AppUser actor) {
        requireReader(actor);
        return environments.findAllByOrderByEnvironmentTypeAscNameAsc().stream().map(PlatformAdminResponses.EnvironmentResponse::from).toList();
    }

    @Transactional
    public PlatformAdminResponses.EnvironmentResponse saveEnvironment(PlatformAdminRequests.EnvironmentRequest request, AppUser actor) {
        requireFounder(actor);
        PlatformEnvironmentRecord record = new PlatformEnvironmentRecord();
        record.setName(request.name().trim());
        record.setEnvironmentType(request.environmentType());
        record.setUrl(blankToNull(request.url()));
        record.setVersion(blankToNull(request.version()));
        record.setBuildNumber(blankToNull(request.buildNumber()));
        record.setDeploymentDate(request.deploymentDate());
        record.setStatus(request.status());
        record.setHealth(request.health());
        record.setRegion(blankToNull(request.region()));
        PlatformEnvironmentRecord saved = environments.saveAndFlush(record);
        auditService.record(actor, MODULE, "ENVIRONMENT_RECORDED", "Recorded platform environment " + saved.getName(), "IMPORTANT");
        return PlatformAdminResponses.EnvironmentResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PlatformAdminResponses.ServiceResponse> listServices(AppUser actor) {
        requireReader(actor);
        return services.findAllByOrderByServiceNameAsc().stream().map(PlatformAdminResponses.ServiceResponse::from).toList();
    }

    @Transactional
    public PlatformAdminResponses.ServiceResponse saveService(PlatformAdminRequests.ServiceRequest request, AppUser actor) {
        requireFounder(actor);
        PlatformServiceRecord record = new PlatformServiceRecord();
        record.setServiceName(request.serviceName().trim());
        record.setVersion(blankToNull(request.version()));
        record.setStatus(request.status());
        record.setHealth(request.health());
        record.setApiBaseUrl(blankToNull(request.apiBaseUrl()));
        record.setOwner(blankToNull(request.owner()));
        record.setLastDeployment(request.lastDeployment());
        record.setDependencies(blankToNull(request.dependencies()));
        PlatformServiceRecord saved = services.saveAndFlush(record);
        auditService.record(actor, MODULE, "SERVICE_RECORDED", "Recorded platform service " + saved.getServiceName(), "IMPORTANT");
        return PlatformAdminResponses.ServiceResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PlatformAdminResponses.ReleaseResponse> listReleases(AppUser actor) {
        requireReader(actor);
        return releases.findAllByOrderByReleaseDateDescUpdatedAtDesc().stream().map(PlatformAdminResponses.ReleaseResponse::from).toList();
    }

    @Transactional
    public PlatformAdminResponses.ReleaseResponse saveRelease(PlatformAdminRequests.ReleaseRequest request, AppUser actor) {
        requireFounder(actor);
        PlatformReleaseRecord record = new PlatformReleaseRecord();
        record.setVersion(request.version().trim());
        record.setReleaseName(request.releaseName().trim());
        record.setReleaseDate(request.releaseDate());
        record.setModulesIncluded(blankToNull(request.modulesIncluded()));
        record.setBreakingChanges(blankToNull(request.breakingChanges()));
        record.setDatabaseMigrationVersion(blankToNull(request.databaseMigrationVersion()));
        record.setRollbackStatus(request.rollbackStatus());
        PlatformReleaseRecord saved = releases.saveAndFlush(record);
        auditService.record(actor, MODULE, "RELEASE_RECORDED", "Recorded platform release " + saved.getVersion(), "IMPORTANT");
        return PlatformAdminResponses.ReleaseResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PlatformAdminResponses.BackupResponse> listBackups(AppUser actor) {
        requireReader(actor);
        return backups.findAllByOrderByBackupTypeAscUpdatedAtDesc().stream().map(PlatformAdminResponses.BackupResponse::from).toList();
    }

    @Transactional
    public PlatformAdminResponses.BackupResponse saveBackup(PlatformAdminRequests.BackupRequest request, AppUser actor) {
        requireFounder(actor);
        PlatformBackupRecord record = new PlatformBackupRecord();
        record.setBackupType(request.backupType());
        record.setLastBackupAt(request.lastBackupAt());
        record.setNextScheduledBackupAt(request.nextScheduledBackupAt());
        record.setBackupStatus(request.backupStatus());
        record.setBackupSizeBytes(request.backupSizeBytes());
        record.setRestoreTestStatus(request.restoreTestStatus());
        record.setNotes(blankToNull(request.notes()));
        PlatformBackupRecord saved = backups.saveAndFlush(record);
        auditService.record(actor, MODULE, "BACKUP_RECORDED", "Recorded " + saved.getBackupType() + " backup status", "IMPORTANT");
        return PlatformAdminResponses.BackupResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PlatformAdminResponses.JobResponse> listJobs(AppUser actor) {
        requireReader(actor);
        return jobs.findAllByOrderByJobNameAsc().stream().map(PlatformAdminResponses.JobResponse::from).toList();
    }

    @Transactional
    public PlatformAdminResponses.JobResponse saveJob(PlatformAdminRequests.JobRequest request, AppUser actor) {
        requireFounder(actor);
        PlatformJobRecord record = new PlatformJobRecord();
        record.setJobName(request.jobName().trim());
        record.setJobType(request.jobType().trim());
        record.setStatus(request.status());
        record.setLastRunAt(request.lastRunAt());
        record.setNextRunAt(request.nextRunAt());
        record.setOwner(blankToNull(request.owner()));
        record.setNotes(blankToNull(request.notes()));
        PlatformJobRecord saved = jobs.saveAndFlush(record);
        auditService.record(actor, MODULE, "JOB_RECORDED", "Recorded scheduled job " + saved.getJobName(), "INFO");
        return PlatformAdminResponses.JobResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PlatformAdminResponses.ApiResponse> listApis(AppUser actor) {
        requireReader(actor);
        return apis.findAllByOrderByApiNameAsc().stream().map(PlatformAdminResponses.ApiResponse::from).toList();
    }

    @Transactional
    public PlatformAdminResponses.ApiResponse saveApi(PlatformAdminRequests.ApiRequest request, AppUser actor) {
        requireFounder(actor);
        PlatformApiRecord record = new PlatformApiRecord();
        record.setApiName(request.apiName().trim());
        record.setBasePath(request.basePath().trim());
        record.setEndpointCount(request.endpointCount());
        record.setVersion(blankToNull(request.version()));
        record.setAuthenticationRequired(request.authenticationRequired());
        record.setStatus(request.status());
        record.setAverageResponseTimeMs(request.averageResponseTimeMs());
        PlatformApiRecord saved = apis.saveAndFlush(record);
        auditService.record(actor, MODULE, "API_RECORDED", "Recorded platform API " + saved.getApiName(), "INFO");
        return PlatformAdminResponses.ApiResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public PlatformAdminResponses.SecurityCenterResponse securityCenter(AppUser actor) {
        requireReader(actor);
        return securityCenter();
    }

    @Transactional(readOnly = true)
    public List<PlatformAdminResponses.ModuleDependency> dependencies(AppUser actor) {
        requireReader(actor);
        return moduleDependencies();
    }

    private List<PlatformAdminResponses.PlatformMetric> engineeringMetrics() {
        long openTasks = tasks.findAll().stream().filter(task -> task.getStatus() != TaskStatus.DONE && task.getStatus() != TaskStatus.ARCHIVED).count();
        long activeUsers = users.findAll().stream().filter(AppUser::isEnabled).count();
        return List.of(
            new PlatformAdminResponses.PlatformMetric("Total modules", String.valueOf(modules.count())),
            new PlatformAdminResponses.PlatformMetric("Total APIs", String.valueOf(apis.count())),
            new PlatformAdminResponses.PlatformMetric("Database tables", String.valueOf(databaseTableCount())),
            new PlatformAdminResponses.PlatformMetric("Active users", String.valueOf(activeUsers)),
            new PlatformAdminResponses.PlatformMetric("Open tasks", String.valueOf(openTasks)),
            new PlatformAdminResponses.PlatformMetric("Pending approvals", String.valueOf(approvals.countByStatusAndArchivedAtIsNull(ApprovalStatus.PENDING_APPROVAL))),
            new PlatformAdminResponses.PlatformMetric("Application version", applicationVersion),
            new PlatformAdminResponses.PlatformMetric("Build version", buildVersion)
        );
    }

    private List<PlatformAdminResponses.HealthComponent> health() {
        return List.of(
            new PlatformAdminResponses.HealthComponent("Backend health", PlatformHealthState.UP, "Application context is serving platform administration."),
            new PlatformAdminResponses.HealthComponent("Database health", databaseHealth(), migrationDetail()),
            new PlatformAdminResponses.HealthComponent("Storage health", storageHealth(), storageRoot.toString()),
            new PlatformAdminResponses.HealthComponent("Email service", PlatformHealthState.NOT_CONFIGURED, "No information has been added yet."),
            new PlatformAdminResponses.HealthComponent("AI service", PlatformHealthState.NOT_CONFIGURED, "No external AI provider is configured."),
            new PlatformAdminResponses.HealthComponent("Scheduler", jobs.count() == 0 ? PlatformHealthState.NOT_CONFIGURED : PlatformHealthState.UNKNOWN, "Tracked jobs: " + jobs.count()),
            new PlatformAdminResponses.HealthComponent("Queue workers", PlatformHealthState.NOT_CONFIGURED, "No queue worker records have been added yet."),
            new PlatformAdminResponses.HealthComponent("API availability", apis.count() == 0 ? PlatformHealthState.NOT_CONFIGURED : PlatformHealthState.UNKNOWN, "Registered APIs: " + apis.count()),
            new PlatformAdminResponses.HealthComponent("Response times", PlatformHealthState.UNKNOWN, "Use API registry average response time fields."),
            new PlatformAdminResponses.HealthComponent("Error rates", PlatformHealthState.UNKNOWN, "Central error-rate metrics are not configured yet.")
        );
    }

    private PlatformAdminResponses.SecurityCenterResponse securityCenter() {
        long failedAttempts = users.findAll().stream().mapToLong(AppUser::getFailedLoginAttempts).sum();
        long lockedAccounts = users.findAll().stream().filter(user -> user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())).count();
        long activeUsers = users.findAll().stream().filter(AppUser::isEnabled).count();
        List<String> recentEvents = auditLogs.findAll().stream()
            .filter(log -> log.getModule().contains("AUTH") || log.getModule().contains("SECURITY") || log.getAction().contains("LOGIN") || log.getAction().contains("PERMISSION"))
            .sorted((left, right) -> right.getCreatedAt().compareTo(left.getCreatedAt()))
            .limit(10)
            .map(log -> log.getCreatedAt() + " - " + log.getAction() + " - " + log.getActorEmail())
            .toList();
        return new PlatformAdminResponses.SecurityCenterResponse(failedAttempts, lockedAccounts, activeUsers, recentEvents);
    }

    private List<PlatformAdminResponses.ModuleDependency> moduleDependencies() {
        return List.of(
            new PlatformAdminResponses.ModuleDependency("Company Profile", List.of()),
            new PlatformAdminResponses.ModuleDependency("Documents", List.of("Company Profile")),
            new PlatformAdminResponses.ModuleDependency("Board Meetings", List.of("Documents")),
            new PlatformAdminResponses.ModuleDependency("Finance", List.of("Board Meetings")),
            new PlatformAdminResponses.ModuleDependency("Compliance", List.of("Finance", "Documents")),
            new PlatformAdminResponses.ModuleDependency("Tasks", List.of("Compliance")),
            new PlatformAdminResponses.ModuleDependency("Products", List.of("Tasks")),
            new PlatformAdminResponses.ModuleDependency("Reports", List.of("Products", "Finance", "Compliance")),
            new PlatformAdminResponses.ModuleDependency("AI", List.of("Reports", "Search"))
        );
    }

    private PlatformHealthState databaseHealth() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(2) ? PlatformHealthState.UP : PlatformHealthState.DOWN;
        } catch (Exception ex) {
            return PlatformHealthState.DOWN;
        }
    }

    private int databaseTableCount() {
        try (Connection connection = dataSource.getConnection(); ResultSet tables = connection.getMetaData().getTables(null, null, "%", new String[] {"TABLE"})) {
            int count = 0;
            while (tables.next()) count++;
            return count;
        } catch (Exception ex) {
            return 0;
        }
    }

    private PlatformHealthState storageHealth() {
        try {
            Files.createDirectories(storageRoot);
            return Files.isDirectory(storageRoot) && Files.isWritable(storageRoot) ? PlatformHealthState.UP : PlatformHealthState.DOWN;
        } catch (Exception ex) {
            return PlatformHealthState.DOWN;
        }
    }

    private String migrationDetail() {
        try {
            return flyway.info().pending().length == 0 ? "Flyway migrations are up to date." : "Flyway has pending migrations.";
        } catch (Exception ex) {
            return "Flyway migration status is unavailable.";
        }
    }

    private void requireFounder(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER); }
    private void requireReader(AppUser actor) { permissions.requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR); }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
