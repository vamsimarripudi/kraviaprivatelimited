import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token();
  const authRequest = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
  return next(authRequest);
};
