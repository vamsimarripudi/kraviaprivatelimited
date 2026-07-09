import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { LoginComponent } from './auth/login.component';
import { ShellComponent } from './layout/shell.component';
import { CompanyProfileComponent } from './company-profile/company-profile.component';
import { AuditComponent } from './audit/audit.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Sign in' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'company-profile' },
      { path: 'company-profile', component: CompanyProfileComponent, title: 'Company Profile' },
      { path: 'audit-logs', component: AuditComponent, title: 'Audit Logs', canActivate: [roleGuard], data: { roles: ['FOUNDER', 'DIRECTOR'] } }
    ]
  },
  { path: '**', redirectTo: '' }
];
