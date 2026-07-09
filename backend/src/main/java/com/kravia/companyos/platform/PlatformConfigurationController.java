package com.kravia.companyos.platform;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/platform/configuration")
public class PlatformConfigurationController {
    private final PlatformConfigurationService service;

    public PlatformConfigurationController(PlatformConfigurationService service) {
        this.service = service;
    }

    @GetMapping
    public List<PlatformConfigurationResponse> list(@RequestParam(required = false) String category, @AuthenticationPrincipal AppUser actor) {
        return service.list(category, actor);
    }

    @PutMapping
    public PlatformConfigurationResponse upsert(@Valid @RequestBody PlatformConfigurationRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.upsert(request, actor);
    }
}
