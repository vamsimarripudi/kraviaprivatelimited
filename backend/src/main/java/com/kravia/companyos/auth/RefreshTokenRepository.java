package com.kravia.companyos.auth;

import com.kravia.companyos.user.AppUser;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHashAndRevokedAtIsNull(String tokenHash);
    void deleteByUserAndExpiresAtBefore(AppUser user, Instant now);
}
