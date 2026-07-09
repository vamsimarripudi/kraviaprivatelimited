package com.kravia.companyos.company;

import java.time.LocalDate;
import java.util.UUID;

public record CompanyProfileResponse(UUID id, String companyName, String cin, String pan, String tan, String registeredOfficeAddress, String email, String phone, LocalDate dateOfIncorporation, String authorizedCapital, String paidUpCapital, String directors, String shareholders, String companyStatus, LocalDate lastUpdatedDate) {
    public static CompanyProfileResponse from(CompanyProfile profile) {
        return new CompanyProfileResponse(profile.getId(), profile.getCompanyName(), profile.getCin(), profile.getPan(), profile.getTan(), profile.getRegisteredOfficeAddress(), profile.getEmail(), profile.getPhone(), profile.getDateOfIncorporation(), profile.getAuthorizedCapital(), profile.getPaidUpCapital(), profile.getDirectors(), profile.getShareholders(), profile.getCompanyStatus(), profile.getLastUpdatedDate());
    }
}
