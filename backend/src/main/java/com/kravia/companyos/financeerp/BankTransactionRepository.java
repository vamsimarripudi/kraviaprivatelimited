package com.kravia.companyos.financeerp;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BankTransactionRepository extends JpaRepository<BankTransaction, UUID> {
    List<BankTransaction> findAllByOrderByTransactionDateDescCreatedAtDesc();
}
