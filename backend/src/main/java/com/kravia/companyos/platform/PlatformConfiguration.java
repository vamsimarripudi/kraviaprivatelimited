package com.kravia.companyos.platform;

import com.kravia.companyos.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "platform_configurations")
public class PlatformConfiguration extends BaseEntity {
    @Column(nullable = false, unique = true, length = 160)
    private String configKey;

    @Column(length = 3000)
    private String configValue;

    @Column(nullable = false, length = 80)
    private String category;

    @Column(nullable = false)
    private boolean sensitive;

    public String getConfigKey() { return configKey; }
    public void setConfigKey(String configKey) { this.configKey = configKey; }
    public String getConfigValue() { return configValue; }
    public void setConfigValue(String configValue) { this.configValue = configValue; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public boolean isSensitive() { return sensitive; }
    public void setSensitive(boolean sensitive) { this.sensitive = sensitive; }
}
