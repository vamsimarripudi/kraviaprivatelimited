package com.kravia.companyos.sales;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record SalesCustomerRequest(
    @NotBlank @Size(max = 255) String customerName,
    @Size(max = 255) String organizationType,
    @NotBlank @Size(max = 255) String product,
    @Size(max = 255) String plan,
    @Size(max = 255) String subscriptionStatus,
    LocalDate startDate,
    LocalDate renewalDate,
    @Size(max = 255) String paymentStatus,
    @Size(max = 255) String supportStatus,
    @Size(max = 255) String onboardingStatus,
    @Size(max = 4000) String notes
) {}
