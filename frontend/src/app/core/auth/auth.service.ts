import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, Role, UserSession } from '../models/auth.models';

const TOKEN_KEY = 'kravia.companyos.token';
const REFRESH_TOKEN_KEY = 'kravia.companyos.refreshToken';
const TOKEN_EXPIRES_AT_KEY = 'kravia.companyos.tokenExpiresAt';
const USER_KEY = 'kravia.companyos.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly userState = signal<UserSession | null>(this.loadUser());

  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.userState() && this.token()));
  readonly roles = computed<Role[]>(() => this.userState()?.roles ?? []);

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      tap((response) => this.storeSession(response))
    );
  }

  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/refresh', { refreshToken: this.refreshTokenValue() }).pipe(
      tap((response) => this.storeSession(response))
    );
  }

  refreshCurrentUser(): Observable<UserSession> {
    return this.http.get<UserSession>('/api/auth/me').pipe(
      tap((user) => {
        sessionStorage.setItem(USER_KEY, JSON.stringify(user));
        this.userState.set(user);
      })
    );
  }

  logout(): void {
    let cleared = false;
    const finish = () => {
      if (cleared) return;
      cleared = true;
      this.clearSession();
    };
    this.http.post<void>('/api/auth/logout', {}).subscribe({ next: finish, error: finish, complete: finish });
  }

  token(): string | null { return sessionStorage.getItem(TOKEN_KEY); }
  refreshTokenValue(): string | null { return sessionStorage.getItem(REFRESH_TOKEN_KEY); }
  tokenExpiresAt(): string | null { return sessionStorage.getItem(TOKEN_EXPIRES_AT_KEY); }

  hasAnyRole(roles: Role[]): boolean {
    const current = this.roles();
    return roles.some((role) => current.includes(role));
  }

  private storeSession(response: AuthResponse): void {
    sessionStorage.setItem(TOKEN_KEY, response.token);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    sessionStorage.setItem(TOKEN_EXPIRES_AT_KEY, response.expiresAt);
    sessionStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.userState.set(response.user);
  }

  private clearSession(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.userState.set(null);
    void this.router.navigateByUrl('/login');
  }

  private loadUser(): UserSession | null {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as UserSession; } catch { return null; }
  }
}
