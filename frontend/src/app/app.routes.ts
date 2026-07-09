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
import { ComplianceComponent } from './compliance/compliance.component';
import { TasksComponent } from './tasks/tasks.component';
import { ProductsComponent } from './products/products.component';
import { ContactsComponent } from './contacts/contacts.component';
import { AnnouncementsComponent } from './announcements/announcements.component';
import { NotificationsComponent } from './notifications/notifications.component';
import { ReportsComponent } from './reports/reports.component';
import { SearchComponent } from './search/search.component';
import { AiAssistantComponent } from './ai-assistant/ai-assistant.component';

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
      { path: 'compliance', component: ComplianceComponent, title: 'Compliance Center' },
      { path: 'tasks', component: TasksComponent, title: 'Company Tasks' },
      { path: 'products', component: ProductsComponent, title: 'Products Portfolio' },
      { path: 'contacts', component: ContactsComponent, title: 'Contacts & Partners' },
      { path: 'announcements', component: AnnouncementsComponent, title: 'Announcements' },
      { path: 'notifications', component: NotificationsComponent, title: 'Notifications' },
      { path: 'reports', component: ReportsComponent, title: 'Reports' },
      { path: 'search', component: SearchComponent, title: 'Global Search' },
      { path: 'ai-assistant', component: AiAssistantComponent, title: 'Executive AI Assistant', canActivate: [roleGuard], data: { roles: ['FOUNDER', 'DIRECTOR'] } },
      { path: 'audit-logs', component: AuditComponent, title: 'Audit Logs', canActivate: [roleGuard], data: { roles: ['FOUNDER', 'DIRECTOR'] } }
    ]
  },
  { path: '**', redirectTo: '' }
];
