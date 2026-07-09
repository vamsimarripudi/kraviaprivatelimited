package com.kravia.companyos.sales;

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
@RequestMapping("/sales")
public class SalesController {
    private final SalesService service;

    public SalesController(SalesService service) { this.service = service; }

    @PostMapping("/leads")
    public SalesLeadResponse createLead(@Valid @RequestBody SalesLeadRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createLead(request, actor);
    }

    @GetMapping("/leads")
    public List<SalesLeadResponse> listLeads(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) LeadStage stage,
        @RequestParam(required = false) LeadPriority priority,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.listLeads(query, stage, priority, actor);
    }

    @GetMapping("/leads/{id}")
    public SalesLeadResponse getLead(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.getLead(id, actor);
    }

    @PutMapping("/leads/{id}")
    public SalesLeadResponse updateLead(@PathVariable UUID id, @Valid @RequestBody SalesLeadRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateLead(id, request, actor);
    }

    @DeleteMapping("/leads/{id}")
    public void archiveLead(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveLead(id, actor);
    }

    @PostMapping("/customers")
    public SalesCustomerResponse createCustomer(@Valid @RequestBody SalesCustomerRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.createCustomer(request, actor);
    }

    @GetMapping("/customers")
    public List<SalesCustomerResponse> listCustomers(
        @RequestParam(required = false) String query,
        @RequestParam(required = false) String product,
        @RequestParam(required = false) String subscriptionStatus,
        @AuthenticationPrincipal AppUser actor
    ) {
        return service.listCustomers(query, product, subscriptionStatus, actor);
    }

    @GetMapping("/customers/{id}")
    public SalesCustomerResponse getCustomer(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        return service.getCustomer(id, actor);
    }

    @PutMapping("/customers/{id}")
    public SalesCustomerResponse updateCustomer(@PathVariable UUID id, @Valid @RequestBody SalesCustomerRequest request, @AuthenticationPrincipal AppUser actor) {
        return service.updateCustomer(id, request, actor);
    }

    @DeleteMapping("/customers/{id}")
    public void archiveCustomer(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) {
        service.archiveCustomer(id, actor);
    }
}
