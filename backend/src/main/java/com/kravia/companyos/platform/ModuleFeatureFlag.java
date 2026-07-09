package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "module_feature_flags")
public class ModuleFeatureFlag extends BaseEntity {
    @Column(nullable = false, unique = true, length = 120)
    private String flagKey;

    @Column(nullable = false)
    private boolean enabled;

    @Column(length = 500)
    private String description;

    public String getFlagKey() { return flagKey; }
    public void setFlagKey(String flagKey) { this.flagKey = flagKey; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
