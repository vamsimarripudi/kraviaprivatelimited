package com.kravia.companyos.task;

import jakarta.validation.constraints.NotNull;

public record TaskStatusRequest(@NotNull TaskStatus status) {}