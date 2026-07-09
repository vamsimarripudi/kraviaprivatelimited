package com.kravia.companyos.product;

import com.kravia.companyos.user.AppUser;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/products")
public class ProductRecordController {
    private final ProductRecordService service;

    public ProductRecordController(ProductRecordService service) { this.service = service; }

    @GetMapping
    public List<ProductRecordResponse> list() { return service.list(); }

    @GetMapping("/{id}")
    public ProductRecordResponse get(@PathVariable UUID id) { return service.get(id); }

    @PostMapping
    public ProductRecordResponse create(@Valid @RequestBody ProductRecordRequest request, @AuthenticationPrincipal AppUser actor) { return service.save(request, actor); }

    @PutMapping("/{id}")
    public ProductRecordResponse update(@PathVariable UUID id, @Valid @RequestBody ProductRecordRequest request, @AuthenticationPrincipal AppUser actor) { return service.update(id, request, actor); }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser actor) { service.archive(id, actor); }
}
