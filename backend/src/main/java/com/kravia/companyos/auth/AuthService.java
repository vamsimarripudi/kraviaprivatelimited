package com.kravia.companyos.auth;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.security.JwtService;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService, AuditService auditService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
    }

    public AuthResponse login(LoginRequest request) {
        AppUser user = users.findByEmailIgnoreCase(request.email()).filter(AppUser::isEnabled)
            .orElseThrow(() -> new ForbiddenOperationException("Invalid email or password."));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ForbiddenOperationException("Invalid email or password.");
        }
        auditService.record(user, "AUTH", "LOGIN", "User signed in.", "INFO");
        return responseFor(user, jwtService.createToken(user));
    }

    public AuthResponse.UserSession currentUser(AppUser user) {
        return new AuthResponse.UserSession(user.getId(), user.getEmail(), user.getDisplayName(), user.getRoleNames());
    }

    private AuthResponse responseFor(AppUser user, String token) {
        return new AuthResponse(token, currentUser(user));
    }
}
