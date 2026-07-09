package com.kravia.companyos.security;

import com.kravia.companyos.user.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final SecretKey key;
    private final long expirationMinutes;

    public JwtService(@Value("${kravia.security.jwt-secret}") String secret, @Value("${kravia.security.jwt-expiration-minutes}") long expirationMinutes) {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) throw new IllegalStateException("KRAVIA_JWT_SECRET must be at least 32 bytes.");
        if (expirationMinutes < 5) throw new IllegalStateException("JWT expiration must be at least 5 minutes.");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMinutes = expirationMinutes;
    }

    public String createToken(AppUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getEmail())
            .claim("uid", user.getId().toString())
            .claim("name", user.getDisplayName())
            .claim("roles", user.getRoleNames().stream().map(Enum::name).sorted().toList())
            .issuedAt(Date.from(now))
            .expiration(Date.from(expiresAt(now)))
            .signWith(key)
            .compact();
    }

    public Instant expiresAt() { return expiresAt(Instant.now()); }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    private Instant expiresAt(Instant now) { return now.plusSeconds(expirationMinutes * 60); }
}
