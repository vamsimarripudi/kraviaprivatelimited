package com.kravia.companyos.user;

import com.kravia.companyos.audit.AuditService;
import com.kravia.companyos.common.ModuleType;
import com.kravia.companyos.common.NotFoundException;
import com.kravia.companyos.security.PermissionService;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;
    private final PermissionService permissions;

    public UserService(UserRepository users, PasswordEncoder passwordEncoder, AuditService auditService, PermissionService permissions) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
        this.permissions = permissions;
    }

    public List<UserResponse> list(AppUser actor) {
        permissions.requireFounder(actor, "Only founders can view user accounts.");
        return users.findAll().stream().map(UserResponse::from).toList();
    }

    @Transactional
    public UserResponse create(UserCreateRequest request, AppUser actor) {
        permissions.requireFounder(actor, "Only founders can create users.");
        if (users.existsByEmailIgnoreCase(request.email())) throw new IllegalArgumentException("User email already exists.");
        AppUser user = new AppUser();
        user.setEmail(request.email().trim().toLowerCase());
        user.setDisplayName(request.displayName().trim());
        user.setRole(request.role());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEnabled(true);
        AppUser saved = users.save(user);
        auditService.record(actor, ModuleType.SETTING, "USER_CREATED", "Created user " + saved.getEmail(), "IMPORTANT");
        return UserResponse.from(saved);
    }

    @Transactional
    public void disable(UUID id, AppUser actor) {
        permissions.requireFounder(actor, "Only founders can disable users.");
        AppUser user = users.findById(id).orElseThrow(() -> new NotFoundException("User not found."));
        user.setEnabled(false);
        auditService.record(actor, ModuleType.SETTING, "USER_DISABLED", "Disabled user " + user.getEmail(), "WARNING");
    }
}
