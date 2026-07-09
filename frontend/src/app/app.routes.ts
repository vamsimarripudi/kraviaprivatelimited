import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { LoginComponent } from './auth/login.component';
import { ShellComponent } from './layout/shell.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CompanyProfileComponent } from './company-profile/company-profile.component';
import { DocumentsComponent } from './documents/documents.component';
import { RecordPageComponent } from './shared/record-page/record-page.component';
import { AuditComponent } from './audit/audit.component';
import { SearchComponent } from './search/search.component';
import { UsersComponent } from './users/users.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardComponent, title: 'Dashboard' },
      { path: 'company-profile', component: CompanyProfileComponent, title: 'Company Profile' },
      { path: 'documents', component: DocumentsComponent, title: 'Document Vault' },
      { path: 'board-meetings', component: RecordPageComponent, data: { title: 'Board Meetings', path: 'board-meetings', empty: 'No board meeting records have been added yet.' } },
      { path: 'finance', component: RecordPageComponent, data: { title: 'Financial Records', path: 'financial-records', empty: 'No financial records have been added yet.' } },
      { path: 'compliance', component: RecordPageComponent, data: { title: 'Compliance Center', path: 'compliance-items', empty: 'No compliance items have been added yet.' } },
      { path: 'tasks', component: RecordPageComponent, data: { title: 'Tasks', path: 'tasks', empty: 'No company tasks have been added yet.' } },
      { path: 'products', component: RecordPageComponent, data: { title: 'Products Portfolio', path: 'products', empty: 'No product records have been added yet.' } },
      { path: 'contacts', component: RecordPageComponent, data: { title: 'Contacts & Partners', path: 'contacts', empty: 'No contacts have been added yet.' } },
      { path: 'audit', component: AuditComponent, data: { roles: ['FOUNDER', 'DIRECTOR'] }, canActivate: [authGuard] },
      { path: 'users', component: UsersComponent, data: { roles: ['FOUNDER'] }, canActivate: [authGuard] },
      { path: 'settings', component: RecordPageComponent, data: { title: 'Settings', path: 'settings', empty: 'No information has been added yet.', roles: ['FOUNDER', 'DIRECTOR'], writeRoles: ['FOUNDER'] }, canActivate: [authGuard] },
      { path: 'announcements', component: RecordPageComponent, data: { title: 'Announcements', path: 'announcements', empty: 'No announcements have been added yet.' } },
      { path: 'notifications', component: RecordPageComponent, data: { title: 'Notifications', path: 'notifications', empty: 'No notifications have been added yet.' } },
      { path: 'reports', component: RecordPageComponent, data: { title: 'Reports', path: 'reports', empty: 'No reports have been added yet.' } },
      { path: 'search', component: SearchComponent },
      { path: 'ai-assistant', component: RecordPageComponent, data: { title: 'AI Assistant Data Layer', path: 'ai/context', empty: 'No AI assistant data records have been added yet.' } }
    ]
  }
];

