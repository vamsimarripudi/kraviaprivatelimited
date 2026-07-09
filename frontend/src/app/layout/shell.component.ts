import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { Role } from '../core/models/auth.models';

interface NavItem { label: string; path: string; roles?: Role[]; }

@Component({
  selector: 'kravia-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.component.html'
})
export class ShellComponent {
  private readonly auth = inject(AuthService);
  readonly dark = signal(false);
  readonly user = this.auth.user;
  readonly roles = this.auth.roles;
  readonly navItems: NavItem[] = [
    { label: 'Company Profile', path: '/company-profile' },
    { label: 'Documents', path: '/documents' },
    { label: 'Board Meetings', path: '/board-meetings' },
    { label: 'Finance', path: '/finance' },
    { label: 'Compliance', path: '/compliance' },
    { label: 'Audit Logs', path: '/audit-logs', roles: ['FOUNDER', 'DIRECTOR'] }
  ];
  readonly visibleNav = computed(() => this.navItems.filter((item) => !item.roles || this.auth.hasAnyRole(item.roles)));

  toggleTheme(): void {
    this.dark.update((value) => !value);
    document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
  }

  print(): void { window.print(); }
  logout(): void { this.auth.logout(); }
}
