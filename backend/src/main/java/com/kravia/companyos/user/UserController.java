package com.kravia.companyos.user;

import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService service;

    public UserController(UserService service) { this.service = service; }

    @GetMapping
    public List<UserResponse> list(@AuthenticationPrincipal AppUser actor) { return service.list(actor); }

    @PostMapping
    public UserResponse create(@Valid @RequestBody UserCreateRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @DeleteMapping("/{id}")
    public void disable(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.disable(id, actor);
    }
}
