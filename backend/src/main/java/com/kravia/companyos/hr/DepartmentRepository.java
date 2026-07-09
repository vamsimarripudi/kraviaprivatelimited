package com.kravia.companyos.hr;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DepartmentRepository extends JpaRepository<Department, UUID> {
    boolean existsByDepartmentNameIgnoreCase(String departmentName);
    List<Department> findAllByOrderByDepartmentNameAsc();
}
