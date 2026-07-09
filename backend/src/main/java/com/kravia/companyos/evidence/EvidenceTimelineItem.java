package com.kravia.companyos.evidence;

import java.time.Instant;
import java.util.UUID;

public record EvidenceTimelineItem(
    UUID id,
    String source,
    String module,
    String action,
    String actor,
    String description,
    Instant timestamp
) {}
