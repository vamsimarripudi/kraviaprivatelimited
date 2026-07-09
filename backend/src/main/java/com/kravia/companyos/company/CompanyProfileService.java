package com.kravia.companyos.company;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.security.PermissionService;
import com.kravia.companyos.user.AppUser;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

@Service
public class CompanyProfileService {
    private final CompanyProfileRepository repository;
    private final AuditService auditService;
    private final PermissionService permissions;

    public CompanyProfileService(CompanyProfileRepository repository, AuditService auditService, PermissionService permissions) {
        this.repository = repository;
        this.auditService = auditService;
        this.permissions = permissions;
    }

    public CompanyProfileResponse get() {
        CompanyProfile profile = repository.findAll().stream().findFirst().orElseGet(() -> repository.save(new CompanyProfile()));
        return CompanyProfileResponse.from(profile);
    }

    @Transactional
    public CompanyProfileResponse save(CompanyProfileRequest request, AppUser actor) {
        permissions.requireCompanyProfileEditor(actor);
        CompanyProfile profile = repository.findAll().stream().findFirst().orElseGet(CompanyProfile::new);
        profile.setCompanyName(request.companyName());
        profile.setCin(request.cin());
        profile.setPan(request.pan());
        profile.setTan(request.tan());
        profile.setRegisteredOfficeAddress(request.registeredOfficeAddress());
        profile.setEmail(request.email());
        profile.setPhone(request.phone());
        profile.setDateOfIncorporation(request.dateOfIncorporation());
        profile.setAuthorizedCapital(request.authorizedCapital());
        profile.setPaidUpCapital(request.paidUpCapital());
        profile.setDirectors(request.directors());
        profile.setShareholders(request.shareholders());
        profile.setCompanyStatus(request.companyStatus());
        profile.setLastUpdatedDate(request.lastUpdatedDate());
        CompanyProfile saved = repository.save(profile);
        auditService.record(actor, "COMPANY_PROFILE", "PROFILE_UPDATED", "Company profile was updated.", "IMPORTANT");
        return CompanyProfileResponse.from(saved);
    }
}
