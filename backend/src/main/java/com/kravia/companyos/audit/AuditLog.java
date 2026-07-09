package com.kravia.companyos.audit;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "audit_logs")
public class AuditLog extends BaseEntity {
    @Column(nullable = false, length = 320)
    private String actorEmail;

    @Column(nullable = false)
    private String actorName;

    @Column(nullable = false)
    private String actorRoles;

    @Column(nullable = false, length = 80)
    private String module;

    @Column(nullable = false, length = 120)
    private String action;

    @Column(nullable = false, length = 2000)
    private String description;

    @Column(nullable = false, length = 40)
    private String severity;

    public String getActorEmail() { return actorEmail; }
    public void setActorEmail(String actorEmail) { this.actorEmail = actorEmail; }
    public String getActorName() { return actorName; }
    public void setActorName(String actorName) { this.actorName = actorName; }
    public String getActorRoles() { return actorRoles; }
    public void setActorRoles(String actorRoles) { this.actorRoles = actorRoles; }
    public String getModule() { return module; }
    public void setModule(String module) { this.module = module; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }
}
