package com.kravia.companyos.user;

import com.kravia.companyos.common.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;

@Entity
@Table(name = "roles")
public class RoleEntity {
    @Id
    @Enumerated(EnumType.STRING)
    @Column(length = 40, nullable = false)
    private Role name;

    protected RoleEntity() {}

    public RoleEntity(Role name) { this.name = name; }

    public Role getName() { return name; }
    public void setName(Role name) { this.name = name; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RoleEntity that)) return false;
        return name == that.name;
    }

    @Override
    public int hashCode() { return Objects.hash(name); }
}
