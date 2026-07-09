package com.kravia.companyos.user;

import com.kravia.companyos.common.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UserCreateRequest(
    @NotBlank @Email String email,
    @NotBlank String displayName,
    @NotNull Role role,
    @NotBlank @Size(min = 12) String password
) {}
