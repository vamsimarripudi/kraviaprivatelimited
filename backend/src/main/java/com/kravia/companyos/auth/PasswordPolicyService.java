package com.kravia.companyos.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PasswordPolicyService {
    private final int minLength;

    public PasswordPolicyService(@Value("${kravia.security.password-min-length:12}") int minLength) {
        this.minLength = minLength;
    }

    public void validate(String password) {
        if (password == null || password.length() < minLength) throw new IllegalArgumentException("Password must be at least " + minLength + " characters.");
        if (password.chars().noneMatch(Character::isUpperCase)) throw new IllegalArgumentException("Password must include an uppercase letter.");
        if (password.chars().noneMatch(Character::isLowerCase)) throw new IllegalArgumentException("Password must include a lowercase letter.");
        if (password.chars().noneMatch(Character::isDigit)) throw new IllegalArgumentException("Password must include a number.");
        if (password.chars().noneMatch(ch -> !Character.isLetterOrDigit(ch))) throw new IllegalArgumentException("Password must include a symbol.");
    }
}
