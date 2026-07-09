package com.kravia.companyos.search;

import com.kravia.companyos.user.AppUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/search")
public class SearchController {
    private final SearchService service;

    public SearchController(SearchService service) { this.service = service; }

    @GetMapping
    public SearchResponse search(@RequestParam(name = "q", required = false) String query, @AuthenticationPrincipal AppUser actor) {
        return service.search(query, actor);
    }
}
