package com.kravia.companyos.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {
    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final int limit;
    private final long windowSeconds;

    public RateLimitingFilter(@Value("${kravia.security.rate-limit.requests-per-window:120}") int limit, @Value("${kravia.security.rate-limit.window-seconds:60}") long windowSeconds) {
        this.limit = limit;
        this.windowSeconds = windowSeconds;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        if (isAllowed(clientKey(request))) {
            filterChain.doFilter(request, response);
            return;
        }
        response.setStatus(429);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Too many requests. Try again later.\"}");
    }

    private boolean isAllowed(String key) {
        long now = Instant.now().getEpochSecond();
        Window window = windows.compute(key, (ignored, current) -> {
            if (current == null || now - current.startedAt >= windowSeconds) return new Window(now, 1);
            current.count++;
            return current;
        });
        return window.count <= limit;
    }

    private String clientKey(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        String ip = forwarded == null || forwarded.isBlank() ? request.getRemoteAddr() : forwarded.split(",")[0].trim();
        return ip + ":" + request.getRequestURI();
    }

    private static final class Window {
        private final long startedAt;
        private int count;
        private Window(long startedAt, int count) { this.startedAt = startedAt; this.count = count; }
    }
}
