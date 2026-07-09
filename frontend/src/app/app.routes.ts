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
import { ErrorPageComponent } from './fallback/error-page.component';
import { NotFoundComponent } from './fallback/not-found.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Sign in' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./dashboard/executive-dashboard.component').then((m) => m.ExecutiveDashboardComponent), title: 'Executive Dashboard' },
      { path: 'governance', loadComponent: () => import('./governance/governance.component').then((m) => m.GovernanceComponent), title: 'Governance Dashboard' },
      { path: 'platform-admin', loadComponent: () => import('./platform-admin/platform-admin.component').then((m) => m.PlatformAdminComponent), title: 'Platform Administration', canActivate: [roleGuard], data: { roles: ['FOUNDER', 'DIRECTOR'] } },
      { path: 'ecosystem', loadComponent: () => import('./ecosystem/ecosystem.component').then((m) => m.EcosystemComponent), title: 'Ecosystem Control Plane' },
      { path: 'sales', loadComponent: () => import('./sales/sales.component').then((m) => m.SalesComponent), title: 'Sales Pipeline' },
      { path: 'privacy-center', loadComponent: () => import('./privacy-center/privacy-center.component').then((m) => m.PrivacyCenterComponent), title: 'Privacy Center' },
      { path: 'approvals', loadComponent: () => import('./approvals/approvals.component').then((m) => m.ApprovalsComponent), title: 'Approvals' },
      { path: 'risk-register', loadComponent: () => import('./risk-register/risk-register.component').then((m) => m.RiskRegisterComponent), title: 'Risk Register' },
      { path: 'evidence-packs', loadComponent: () => import('./evidence-packs/evidence-packs.component').then((m) => m.EvidencePacksComponent), title: 'Evidence Packs' },
      { path: 'company-profile', component: CompanyProfileComponent, title: 'Company Profile' },
      { path: 'documents', component: DocumentsComponent, title: 'Documents' },
      { path: 'board-meetings', component: BoardMeetingsComponent, title: 'Board Meetings' },
      { path: 'finance', component: FinanceComponent, title: 'Financial Dashboard' },
      { path: 'finance-erp', loadComponent: () => import('./finance-erp/finance-erp.component').then((m) => m.FinanceErpComponent), title: 'Finance ERP' },
      { path: 'procurement', loadComponent: () => import('./procurement/procurement.component').then((m) => m.ProcurementComponent), title: 'Procurement' },
      { path: 'assets', loadComponent: () => import('./assets/assets.component').then((m) => m.AssetsComponent), title: 'Asset Management' },
      { path: 'hr', loadComponent: () => import('./hr/hr.component').then((m) => m.HrComponent), title: 'HR & Organization' },
      { path: 'legal', loadComponent: () => import('./legal/legal.component').then((m) => m.LegalComponent), title: 'Legal & Contracts' },
      { path: 'analytics', loadComponent: () => import('./analytics/analytics.component').then((m) => m.AnalyticsComponent), title: 'Business Intelligence & Analytics' },
      { path: 'compliance', component: ComplianceComponent, title: 'Compliance Center' },
      { path: 'tasks', component: TasksComponent, title: 'Company Tasks' },
      { path: 'products', component: ProductsComponent, title: 'Products Portfolio' },
      { path: 'contacts', component: ContactsComponent, title: 'Contacts & Partners' },
      { path: 'announcements', component: AnnouncementsComponent, title: 'Announcements' },
      { path: 'notifications', component: NotificationsComponent, title: 'Notifications' },
      { path: 'reports', component: ReportsComponent, title: 'Reports' },
      { path: 'search', component: SearchComponent, title: 'Global Search' },
      { path: 'ai-assistant', component: AiAssistantComponent, title: 'Executive AI Assistant', canActivate: [roleGuard], data: { roles: ['FOUNDER', 'DIRECTOR'] } },
      { path: 'audit-logs', component: AuditComponent, title: 'Audit Logs', canActivate: [roleGuard], data: { roles: ['FOUNDER', 'DIRECTOR'] } },
      { path: 'error', component: ErrorPageComponent, title: 'Application Error' },
      { path: 'not-found', component: NotFoundComponent, title: 'Not Found' }
    ]
  },
  { path: '**', redirectTo: 'not-found' }
];
