package com.kravia.companyos.health;

import java.time.Instant;
import java.util.Map;

public record HealthResponse(String status, Instant checkedAt, Map<String, String> details) {}
