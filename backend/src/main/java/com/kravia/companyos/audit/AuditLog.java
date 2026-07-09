package com.kravia.companyos.audit;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.common.ModuleType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "audit_logs")
public class AuditLog extends BaseEntity {
    @Column(nullable = false)
    private String actorEmail;

    @Column(nullable = false)
    private String actorName;

    @Column(nullable = false)
    private String actorRole;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ModuleType module;

    @Column(nullable = false)
    private String action;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false)
    private String severity;

    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String actorEmail) { this.actorEmail = actorEmail; }
    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }
    public String getActorRole() { return actorRole; }
    public void setActorRole(String actorRole) { this.actorRole = actorRole; }
    public ModuleType getModule() { return module; }
    public void setModule(ModuleType module) { this.module = module; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
}
