package com.kravia.companyos.search;

import java.time.Instant;
import java.util.List;

public record SearchResponse(String query, Instant searchedAt, int totalResults, List<SearchGroup> groups) {}
