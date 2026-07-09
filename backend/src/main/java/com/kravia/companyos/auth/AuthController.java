package com.kravia.companyos.auth;

import com.kravia.companyos.user.AppUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) { this.authService = authService; }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        return authService.login(request, clientIp(servletRequest));
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshTokenRequest request, HttpServletRequest servletRequest) {
        return authService.refresh(request, clientIp(servletRequest));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout() { return ResponseEntity.noContent().build(); }

    @GetMapping("/me")
    public AuthResponse.UserSession me(@AuthenticationPrincipal AppUser user) { return authService.currentUser(user); }

    private String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
