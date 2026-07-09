import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/auth.models';
import { AuthService } from './auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = route.data['roles'] as Role[] | undefined;
  if (!allowedRoles?.length) return true;
  return auth.hasAnyRole(allowedRoles) ? true : router.createUrlTree(['/company-profile']);
};
