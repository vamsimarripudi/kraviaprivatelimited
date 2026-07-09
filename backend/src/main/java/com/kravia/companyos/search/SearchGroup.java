package com.kravia.companyos.search;

import java.util.List;

public record SearchGroup(String module, String label, int count, List<SearchResult> results) {}
