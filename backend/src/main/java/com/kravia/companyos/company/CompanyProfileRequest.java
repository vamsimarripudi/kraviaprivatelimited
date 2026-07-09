package com.kravia.companyos.company;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record CompanyProfileRequest(
    @NotBlank String companyName,
    String cin,
    String pan,
    String tan,
    String registeredOfficeAddress,
    @Email String email,
    String phone,
    LocalDate dateOfIncorporation,
    String authorizedCapital,
    String paidUpCapital,
    String directors,
    String shareholders,
    String companyStatus,
    LocalDate lastUpdatedDate
) {}
