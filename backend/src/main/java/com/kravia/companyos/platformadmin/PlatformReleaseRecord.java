package com.kravia.companyos.platformadmin;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "platform_releases")
public class PlatformReleaseRecord extends BaseEntity {
    @Column(nullable = false, length = 80)
    private String version;

    @Column(nullable = false, length = 200)
    private String releaseName;

    private LocalDate releaseDate;

    @Column(length = 2000)
    private String modulesIncluded;

    @Column(length = 3000)
    private String breakingChanges;

    @Column(length = 120)
    private String databaseMigrationVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 60)
    private RollbackStatus rollbackStatus = RollbackStatus.UNKNOWN;

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }
    public String getReleaseName() { return releaseName; }
    public void setReleaseName(String releaseName) { this.releaseName = releaseName; }
    public LocalDate getReleaseDate() { return releaseDate; }
    public void setReleaseDate(LocalDate releaseDate) { this.releaseDate = releaseDate; }
    public String getModulesIncluded() { return modulesIncluded; }
    public void setModulesIncluded(String modulesIncluded) { this.modulesIncluded = modulesIncluded; }
    public String getBreakingChanges() { return breakingChanges; }
    public void setBreakingChanges(String breakingChanges) { this.breakingChanges = breakingChanges; }
    public String getDatabaseMigrationVersion() { return databaseMigrationVersion; }
    public void setDatabaseMigrationVersion(String databaseMigrationVersion) { this.databaseMigrationVersion = databaseMigrationVersion; }
    public RollbackStatus getRollbackStatus() { return rollbackStatus; }
    public void setRollbackStatus(RollbackStatus rollbackStatus) { this.rollbackStatus = rollbackStatus; }
}
