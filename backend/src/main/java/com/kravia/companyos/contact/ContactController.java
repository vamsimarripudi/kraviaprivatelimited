package com.kravia.companyos.contact;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/contacts")
public class ContactController {
    private final ContactService service;

    public ContactController(ContactService service) { this.service = service; }

    @PostMapping
    public ContactResponse create(@Valid @RequestBody ContactRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.create(request, actor);
    }

    @GetMapping
    public List<ContactResponse> list(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) ContactCategory category,
        @RequestParam(required = false) ContactStatus status,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.list(query, category, status, actor);
    }

    @GetMapping("/{id}")
    public ContactResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.get(id, actor);
    }

    @PutMapping("/{id}")
    public ContactResponse update(@PathVariable UUID id, @Valid @RequestBody ContactRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.update(id, request, actor);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archive(id, actor);
    }
}