package com.kravia.companyos.auth;

import com.kravia.companyos.common.Role;
import java.util.UUID;

public record AuthResponse(String token, UserSession user) {
    public record UserSession(UUID id, String email, String displayName, Role role) {}
}
