package com.kravia.companyos.security;

import com.kravia.companyos.common.ForbiddenOperationException;
import com.kravia.companyos.common.Role;
import com.kravia.companyos.user.AppUser;
import java.util.Arrays;
import org.springframework.stereotype.Service;

@Service
public class PermissionService {
    public void requireAnyRole(AppUser actor, Role... allowedRoles) {
        if (actor == null || Arrays.stream(allowedRoles).noneMatch(actor::hasRole)) {
            throw new ForbiddenOperationException("You do not have permission to perform this action.");
        }
    }

    public void requireCompanyProfileEditor(AppUser actor) {
        requireAnyRole(actor, Role.FOUNDER, Role.DIRECTOR);
    }
}
