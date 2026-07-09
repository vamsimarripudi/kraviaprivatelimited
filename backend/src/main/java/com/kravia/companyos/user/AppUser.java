package com.kravia.companyos.user;

import com.kravia.companyos.common.BaseEntity;
import com.kravia.companyos.common.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "users")
public class AppUser extends BaseEntity {
    @Column(nullable = false, unique = true, length = 320)
    private String email;

    @Column(nullable = false)
    private String displayName;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private boolean enabled = true;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_name")
    )
    private Set<RoleEntity> roles = new HashSet<>();

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Set<RoleEntity> getRoles() { return roles; }
    public void setRoles(Set<RoleEntity> roles) { this.roles = roles; }

    public Set<Role> getRoleNames() {
        return roles.stream().map(RoleEntity::getName).collect(Collectors.toUnmodifiableSet());
    }

    public boolean hasRole(Role role) { return getRoleNames().contains(role); }

    public String roleSummary() {
        return getRoleNames().stream().map(Role::name).sorted().collect(Collectors.joining(","));
    }
}
