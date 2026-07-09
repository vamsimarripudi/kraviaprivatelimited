package com.kravia.companyos.company;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CompanyProfileRequest(
    @NotBlank @Size(max = 255) String companyName,
    @Size(max = 80) String cin,
    @Size(max = 80) String pan,
    @Size(max = 80) String tan,
    @Size(max = 2000) String registeredOfficeAddress,
    @Email @Size(max = 320) String email,
    @Size(max = 80) String phone,
    LocalDate dateOfIncorporation,
    @Size(max = 120) String authorizedCapital,
    @Size(max = 120) String paidUpCapital,
    @Size(max = 2000) String directors,
    @Size(max = 2000) String shareholders,
    @Size(max = 120) String companyStatus,
    LocalDate lastUpdatedDate
) {}
