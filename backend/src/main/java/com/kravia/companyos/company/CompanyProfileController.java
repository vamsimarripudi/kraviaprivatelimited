package com.kravia.companyos.company;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/company-profile")
public class CompanyProfileController {
    private final CompanyProfileService service;

    public CompanyProfileController(CompanyProfileService service) { this.service = service; }

    @GetMapping
    public CompanyProfileResponse get() { return service.get(); }

    @PutMapping
    public CompanyProfileResponse save(@Valid @RequestBody CompanyProfileRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.save(request, actor);
    }
}
