package com.kravia.companyos.auth;

import com.kravia.companyos.common.Role;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record AuthResponse(String token, String refreshToken, Instant expiresAt, UserSession user) {
    public record UserSession(UUID id, String email, String displayName, Set<Role> roles) {}
}
