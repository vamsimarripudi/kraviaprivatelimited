package com.kravia.companyos.platform;

import com.kravia.companyos.user.AppUser;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/platform/modules")
public class ModuleRegistryController {
    private final ModuleRegistryService service;

    public ModuleRegistryController(ModuleRegistryService service) {
        this.service = service;
    }

    @GetMapping
    public List<ModuleRegistryResponse> list(@AuthenticationPrincipal AppUser actor) {
        return service.list(actor);
    }

    @PutMapping("/{code}")
    public ModuleRegistryResponse update(@PathVariable String code, @RequestBody ModuleRegistryUpdateRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(code, request, actor);
    }
}
