import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { LoginComponent } from './auth/login.component';
import { ShellComponent } from './layout/shell.component';
import { CompanyProfileComponent } from './company-profile/company-profile.component';
import { AuditComponent } from './audit/audit.component';
import { DocumentsComponent } from './documents/documents.component';
import { BoardMeetingsComponent } from './board-meetings/board-meetings.component';
import { FinanceComponent } from './finance/finance.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Sign in' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'company-profile' },
      { path: 'company-profile', component: CompanyProfileComponent, title: 'Company Profile' },
      { path: 'documents', component: DocumentsComponent, title: 'Documents' },
      { path: 'board-meetings', component: BoardMeetingsComponent, title: 'Board Meetings' },
      { path: 'finance', component: FinanceComponent, title: 'Financial Dashboard' },
      { path: 'audit-logs', component: AuditComponent, title: 'Audit Logs', canActivate: [roleGuard], data: { roles: ['FOUNDER', 'DIRECTOR'] } }
    ]
  },
  { path: '**', redirectTo: '' }
];
