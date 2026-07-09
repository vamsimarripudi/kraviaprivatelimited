package com.kravia.companyos.platformadmin;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/platform-admin")
public class PlatformAdminController {
    private final PlatformAdminService service;

    public PlatformAdminController(PlatformAdminService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public PlatformAdminResponses.PlatformOverviewResponse overview(@AuthenticationPrincipal AppUser actor) {
        return service.overview(actor);
    }

    @GetMapping("/environments")
    public List<PlatformAdminResponses.EnvironmentResponse> environments(@AuthenticationPrincipal AppUser actor) {
        return service.listEnvironments(actor);
    }

    @PostMapping("/environments")
    public PlatformAdminResponses.EnvironmentResponse saveEnvironment(@Valid @RequestBody PlatformAdminRequests.EnvironmentRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveEnvironment(request, actor);
    }

    @GetMapping("/services")
    public List<PlatformAdminResponses.ServiceResponse> services(@AuthenticationPrincipal AppUser actor) {
        return service.listServices(actor);
    }

    @PostMapping("/services")
    public PlatformAdminResponses.ServiceResponse saveService(@Valid @RequestBody PlatformAdminRequests.ServiceRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveService(request, actor);
    }

    @GetMapping("/releases")
    public List<PlatformAdminResponses.ReleaseResponse> releases(@AuthenticationPrincipal AppUser actor) {
        return service.listReleases(actor);
    }

    @PostMapping("/releases")
    public PlatformAdminResponses.ReleaseResponse saveRelease(@Valid @RequestBody PlatformAdminRequests.ReleaseRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveRelease(request, actor);
    }

    @GetMapping("/backups")
    public List<PlatformAdminResponses.BackupResponse> backups(@AuthenticationPrincipal AppUser actor) {
        return service.listBackups(actor);
    }

    @PostMapping("/backups")
    public PlatformAdminResponses.BackupResponse saveBackup(@Valid @RequestBody PlatformAdminRequests.BackupRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveBackup(request, actor);
    }

    @GetMapping("/jobs")
    public List<PlatformAdminResponses.JobResponse> jobs(@AuthenticationPrincipal AppUser actor) {
        return service.listJobs(actor);
    }

    @PostMapping("/jobs")
    public PlatformAdminResponses.JobResponse saveJob(@Valid @RequestBody PlatformAdminRequests.JobRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveJob(request, actor);
    }

    @GetMapping("/apis")
    public List<PlatformAdminResponses.ApiResponse> apis(@AuthenticationPrincipal AppUser actor) {
        return service.listApis(actor);
    }

    @PostMapping("/apis")
    public PlatformAdminResponses.ApiResponse saveApi(@Valid @RequestBody PlatformAdminRequests.ApiRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.saveApi(request, actor);
    }

    @GetMapping("/security-center")
    public PlatformAdminResponses.SecurityCenterResponse securityCenter(@AuthenticationPrincipal AppUser actor) {
        return service.securityCenter(actor);
    }

    @GetMapping("/module-dependencies")
    public List<PlatformAdminResponses.ModuleDependency> dependencies(@AuthenticationPrincipal AppUser actor) {
        return service.dependencies(actor);
    }
}
