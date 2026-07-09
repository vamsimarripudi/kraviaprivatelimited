package com.kravia.companyos.financeerp;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceAccountRepository extends JpaRepository<FinanceAccount, UUID> {
    boolean existsByAccountCodeIgnoreCase(String accountCode);
    Optional<FinanceAccount> findByAccountCodeIgnoreCase(String accountCode);
    List<FinanceAccount> findAllByOrderByAccountCodeAsc();
}
