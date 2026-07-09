package com.kravia.companyos.financeerp;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JournalEntryRepository extends JpaRepository<JournalEntry, UUID> {
    boolean existsByVoucherNumberIgnoreCase(String voucherNumber);
    List<JournalEntry> findAllByOrderByPostingDateDescCreatedAtDesc();
}
