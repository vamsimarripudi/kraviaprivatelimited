package com.kravia.companyos.user;

import com.kravia.companyos.common.Role;
import java.util.UUID;

public record UserResponse(UUID id, String email, String displayName, Role role, boolean enabled) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getRole(), user.isEnabled());
    }
}
