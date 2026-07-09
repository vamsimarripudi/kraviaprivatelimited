package com.kravia.companyos.financeerp;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    boolean existsByInvoiceNumberIgnoreCase(String invoiceNumber);
    List<Invoice> findAllByOrderByDueDateAscCreatedAtDesc();
}
