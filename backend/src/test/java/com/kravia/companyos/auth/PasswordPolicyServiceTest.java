package com.kravia.companyos.auth;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class PasswordPolicyServiceTest {
    private final PasswordPolicyService policy = new PasswordPolicyService(12);

    @Test
    void acceptsStrongPassword() {
        assertDoesNotThrow(() -> policy.validate("StrongPass123!"));
    }

    @Test
    void rejectsWeakPassword() {
        assertThrows(IllegalArgumentException.class, () -> policy.validate("weak"));
    }

    @Test
    void rejectsPasswordWithoutSymbol() {
        assertThrows(IllegalArgumentException.class, () -> policy.validate("StrongPass123"));
    }
}
