package com.kravia.companyos.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AiQueryRequest(
    @NotBlank @Size(max = 2000) String query,
    @JsonProperty("module_context") AiModuleContext moduleContext,
    @JsonProperty("date_range") AiDateRange dateRange,
    @NotNull @JsonProperty("output_type") AiOutputType outputType
) {}
