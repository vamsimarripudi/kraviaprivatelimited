import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, Role, UserSession } from '../models/auth.models';

const TOKEN_KEY = 'kravia.companyos.token';
const USER_KEY = 'kravia.companyos.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly userState = signal<UserSession | null>(this.loadUser());

  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.userState()));
  readonly role = computed<Role | null>(() => this.userState()?.role ?? null);

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        this.userState.set(response.user);
      })
    );
  }

  token(): string | null { return localStorage.getItem(TOKEN_KEY); }

  hasAnyRole(roles: Role[]): boolean {
    const current = this.role();
    return Boolean(current && roles.includes(current));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.userState.set(null);
    void this.router.navigateByUrl('/login');
  }

  private loadUser(): UserSession | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as UserSession; } catch { return null; }
  }
}
