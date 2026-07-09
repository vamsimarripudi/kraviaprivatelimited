package com.kravia.companyos.search;

import java.time.Instant;
import java.util.UUID;

public record SearchResult(UUID id, String title, String description, String status, String route, Instant updatedAt) {}
