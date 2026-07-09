package com.kravia.companyos.finance;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record FinancialRecordRequest(
    @NotBlank @Pattern(regexp = "\\d{4}-\\d{2}") String reportingMonth,
    @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal revenue,
    @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal expenses,
    @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal cashBalance,
    @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal receivables,
    @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal payables,
    @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal gstCollected,
    @NotNull @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal gstPaid,
    @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal cloudSubscriptions,
    @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal vendorPayments,
    @DecimalMin("0.00") @Digits(integer = 17, fraction = 2) BigDecimal directorRemuneration,
    @Size(max = 4000) String founderNotes,
    @NotNull FinancialRecordStatus status
) {}
