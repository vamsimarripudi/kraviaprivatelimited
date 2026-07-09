package com.kravia.companyos.security;

import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.user.AppUser;
import org.springframework.stereotype.Service;

@Service
public class PermissionService {
    public void requireFounder(AppUser actor, String message) {
        if (actor == null || actor.getRole() != Role.FOUNDER) throw new ForbiddenOperationException(message);
    }

    public void requireOperationalWrite(AppUser actor, String message) {
        if (actor == null || actor.getRole() == Role.VIEWER) throw new ForbiddenOperationException(message);
    }
}
