import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';

describe('route guards', () => {
  const router = { createUrlTree: jasmine.createSpy('createUrlTree').and.callFake((commands: string[]) => ({ commands })) };
  const auth = { isAuthenticated: jasmine.createSpy('isAuthenticated'), hasAnyRole: jasmine.createSpy('hasAnyRole') };

  beforeEach(() => {
    router.createUrlTree.calls.reset();
    auth.isAuthenticated.calls.reset();
    auth.hasAnyRole.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth }
      ]
    });
  });

  it('allows authenticated users', () => {
    auth.isAuthenticated.and.returnValue(true);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBeTrue();
  });

  it('redirects anonymous users to login', () => {
    auth.isAuthenticated.and.returnValue(false);
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toEqual({ commands: ['/login'] });
  });

  it('allows users with a required role', () => {
    auth.hasAnyRole.and.returnValue(true);
    const result = TestBed.runInInjectionContext(() => roleGuard({ data: { roles: ['FOUNDER'] } } as never, {} as never));
    expect(result).toBeTrue();
  });

  it('redirects users without a required role', () => {
    auth.hasAnyRole.and.returnValue(false);
    const result = TestBed.runInInjectionContext(() => roleGuard({ data: { roles: ['FOUNDER'] } } as never, {} as never));
    expect(result).toEqual({ commands: ['/company-profile'] });
  });
});
