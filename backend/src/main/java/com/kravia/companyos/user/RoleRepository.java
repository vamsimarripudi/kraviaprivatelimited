package com.kravia.companyos.user;

import com.kravia.companyos.common.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<RoleEntity, Role> {}
