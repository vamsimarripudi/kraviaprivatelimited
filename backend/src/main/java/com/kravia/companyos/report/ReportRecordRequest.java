package com.kravia.companyos.report;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ReportRecordRequest(
    @NotBlank String title,
    @NotBlank String status,
    String ownerName,
    LocalDate dueDate,
    String category,
    String referenceCode,
    BigDecimal amount,
    String details,
    String notes
) {}
