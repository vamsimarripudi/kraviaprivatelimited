package com.kravia.companyos.announcement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record AnnouncementRequest(
    @NotBlank @Size(max = 255) String title,
    @NotBlank @Size(max = 6000) String message,
    @NotNull AnnouncementAudience audience,
    @NotNull AnnouncementStatus status,
    LocalDate expiresAt
) {}