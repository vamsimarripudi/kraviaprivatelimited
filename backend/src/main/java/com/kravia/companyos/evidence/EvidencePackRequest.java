package com.kravia.companyos.evidence;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EvidencePackRequest(
    @NotNull(message = "Evidence pack type is required.")
    EvidencePackType packType,

    @Size(max = 240, message = "Evidence pack title is too long.")
    String title
) {}
