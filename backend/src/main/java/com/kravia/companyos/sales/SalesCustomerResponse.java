package com.kravia.companyos.sales;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SalesCustomerResponse(
    UUID id,
    String customerName,
    String organizationType,
    String product,
    String plan,
    String subscriptionStatus,
    LocalDate startDate,
    LocalDate renewalDate,
    String paymentStatus,
    String supportStatus,
    String onboardingStatus,
    String notes,
    String createdBy,
    Instant createdAt,
    Instant updatedAt,
    Instant archivedAt
) {
    public static SalesCustomerResponse from(SalesCustomer customer) {
        return new SalesCustomerResponse(
            customer.getId(),
            customer.getCustomerName(),
            customer.getOrganizationType(),
            customer.getProduct(),
            customer.getPlan(),
            customer.getSubscriptionStatus(),
            customer.getStartDate(),
            customer.getRenewalDate(),
            customer.getPaymentStatus(),
            customer.getSupportStatus(),
            customer.getOnboardingStatus(),
            customer.getNotes(),
            customer.getCreatedBy(),
            customer.getCreatedAt(),
            customer.getUpdatedAt(),
            customer.getArchivedAt()
        );
    }
}
