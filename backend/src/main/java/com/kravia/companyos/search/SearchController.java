package com.kravia.companyos.search;

import java.util.List;
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
    public List<SearchResult> search(@RequestParam String q) { return service.search(q); }
}
