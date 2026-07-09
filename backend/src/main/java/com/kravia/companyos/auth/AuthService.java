package com.kravia.companyos.auth;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.security.JwtService;
import com.kravia.companyos.user.AppUser;
import com.kravia.companyos.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditService auditService;
    private final SecureRandom secureRandom = new SecureRandom();
    private final int maxFailedAttempts;
    private final long lockoutMinutes;
    private final long refreshTokenDays;

    public AuthService(
        UserRepository users,
        RefreshTokenRepository refreshTokens,
        PasswordEncoder passwordEncoder,
        JwtService jwtService,
        AuditService auditService,
        @Value("${kravia.security.max-failed-login-attempts:5}") int maxFailedAttempts,
        @Value("${kravia.security.account-lockout-minutes:15}") long lockoutMinutes,
        @Value("${kravia.security.refresh-token-days:7}") long refreshTokenDays
    ) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditService = auditService;
        this.maxFailedAttempts = maxFailedAttempts;
        this.lockoutMinutes = lockoutMinutes;
        this.refreshTokenDays = refreshTokenDays;
    }

    @Transactional
    public AuthResponse login(LoginRequest request, String ipAddress) {
        AppUser user = users.findByEmailIgnoreCase(request.email()).filter(AppUser::isEnabled)
            .orElseThrow(() -> new ForbiddenOperationException("Invalid email or password."));
        ensureNotLocked(user);
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            recordFailedLogin(user);
            throw new ForbiddenOperationException("Invalid email or password.");
        }
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(Instant.now());
        users.save(user);
        auditService.record(user, "AUTH", "LOGIN", "User signed in.", "INFO");
        return responseFor(user, createRefreshToken(user, ipAddress));
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request, String ipAddress) {
        String tokenHash = hash(request.refreshToken());
        RefreshToken refreshToken = refreshTokens.findByTokenHashAndRevokedAtIsNull(tokenHash)
            .orElseThrow(() -> new ForbiddenOperationException("Invalid refresh token."));
        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshToken.setRevokedAt(Instant.now());
            refreshTokens.save(refreshToken);
            throw new ForbiddenOperationException("Refresh token expired.");
        }
        AppUser user = refreshToken.getUser();
        ensureNotLocked(user);
        refreshToken.setRevokedAt(Instant.now());
        refreshTokens.save(refreshToken);
        auditService.record(user, "AUTH", "TOKEN_REFRESHED", "JWT refreshed.", "INFO");
        return responseFor(user, createRefreshToken(user, ipAddress));
    }

    public AuthResponse.UserSession currentUser(AppUser user) {
        return new AuthResponse.UserSession(user.getId(), user.getEmail(), user.getDisplayName(), user.getRoleNames());
    }

    private void ensureNotLocked(AppUser user) {
        if (user.getLockedUntil() == null) return;
        if (user.getLockedUntil().isAfter(Instant.now())) throw new ForbiddenOperationException("Account is temporarily locked. Try again later.");
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        users.save(user);
    }

    private void recordFailedLogin(AppUser user) {
        int attempts = user.getFailedLoginAttempts() + 1;
        user.setFailedLoginAttempts(attempts);
        if (attempts >= maxFailedAttempts) {
            user.setLockedUntil(Instant.now().plusSeconds(lockoutMinutes * 60));
            auditService.record(user, "AUTH", "ACCOUNT_LOCKED", "Account locked after failed login attempts.", "WARNING");
        }
        users.save(user);
    }

    private AuthResponse responseFor(AppUser user, String refreshToken) {
        return new AuthResponse(jwtService.createToken(user), refreshToken, jwtService.expiresAt(), currentUser(user));
    }

    private String createRefreshToken(AppUser user, String ipAddress) {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(hash(rawToken));
        refreshToken.setExpiresAt(Instant.now().plusSeconds(refreshTokenDays * 24 * 60 * 60));
        refreshToken.setCreatedByIp(ipAddress);
        refreshTokens.deleteByUserAndExpiresAtBefore(user, Instant.now());
        refreshTokens.save(refreshToken);
        return rawToken;
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable.", ex);
        }
    }
}
