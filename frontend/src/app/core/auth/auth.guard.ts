import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/auth.models';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
  const roles = route.data['roles'] as Role[] | undefined;
  if (roles?.length && !auth.hasAnyRole(roles)) return router.createUrlTree(['/']);
  return true;
};
