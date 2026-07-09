package com.kravia.companyos.financeerp;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinanceBankAccountRepository extends JpaRepository<FinanceBankAccount, UUID> {
    List<FinanceBankAccount> findAllByOrderByBankNameAscAccountNameAsc();
}
