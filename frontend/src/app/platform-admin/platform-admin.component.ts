import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../core/auth/auth.service';
import { ApiService } from '../core/http/api.service';
import {
  ApiRegistryStatus,
  BackupStatus,
  BackupType,
  PlatformEnvironmentType,
  PlatformHealthState,
  PlatformJobStatus,
  PlatformOperationalStatus,
  PlatformOverview,
  RestoreTestStatus,
  RollbackStatus
} from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';

@Component({
  selector: 'kravia-platform-admin',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, ErrorStateComponent, LoadingStateComponent],
  templateUrl: './platform-admin.component.html'
})
export class PlatformAdminComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly overview = signal<PlatformOverview | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly canManage = computed(() => this.auth.hasAnyRole(['FOUNDER']));

  readonly environmentTypes: PlatformEnvironmentType[] = ['DEVELOPMENT', 'TESTING', 'STAGING', 'PRODUCTION', 'DISASTER_RECOVERY'];
  readonly operationalStatuses: PlatformOperationalStatus[] = ['ACTIVE', 'DEGRADED', 'DOWN', 'MAINTENANCE', 'UNKNOWN'];
  readonly healthStates: PlatformHealthState[] = ['UP', 'DEGRADED', 'DOWN', 'UNKNOWN', 'NOT_CONFIGURED'];
  readonly backupTypes: BackupType[] = ['DATABASE', 'FILE', 'CONFIGURATION'];
  readonly backupStatuses: BackupStatus[] = ['NOT_CONFIGURED', 'SCHEDULED', 'COMPLETED', 'FAILED', 'WARNING'];
  readonly restoreStatuses: RestoreTestStatus[] = ['NOT_TESTED', 'PASSED', 'FAILED', 'SCHEDULED'];
  readonly jobStatuses: PlatformJobStatus[] = ['ENABLED', 'DISABLED', 'RUNNING', 'FAILED', 'NOT_CONFIGURED'];
  readonly apiStatuses: ApiRegistryStatus[] = ['ACTIVE', 'DEPRECATED', 'DISABLED', 'UNKNOWN'];
  readonly rollbackStatuses: RollbackStatus[] = ['NOT_REQUIRED', 'AVAILABLE', 'TESTED', 'BLOCKED', 'UNKNOWN'];

  readonly environmentForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    environmentType: ['DEVELOPMENT' as PlatformEnvironmentType, Validators.required],
    url: [''],
    version: [''],
    buildNumber: [''],
    status: ['UNKNOWN' as PlatformOperationalStatus, Validators.required],
    health: ['UNKNOWN' as PlatformHealthState, Validators.required],
    region: ['']
  });

  readonly serviceForm = this.fb.nonNullable.group({
    serviceName: ['', Validators.required],
    version: [''],
    status: ['UNKNOWN' as PlatformOperationalStatus, Validators.required],
    health: ['UNKNOWN' as PlatformHealthState, Validators.required],
    apiBaseUrl: [''],
    owner: [''],
    dependencies: ['']
  });

  readonly releaseForm = this.fb.nonNullable.group({
    version: ['', Validators.required],
    releaseName: ['', Validators.required],
    releaseDate: [''],
    modulesIncluded: [''],
    breakingChanges: [''],
    databaseMigrationVersion: [''],
    rollbackStatus: ['UNKNOWN' as RollbackStatus, Validators.required]
  });

  readonly backupForm = this.fb.nonNullable.group({
    backupType: ['DATABASE' as BackupType, Validators.required],
    backupStatus: ['NOT_CONFIGURED' as BackupStatus, Validators.required],
    backupSizeBytes: [''],
    restoreTestStatus: ['NOT_TESTED' as RestoreTestStatus, Validators.required],
    notes: ['']
  });

  readonly jobForm = this.fb.nonNullable.group({
    jobName: ['', Validators.required],
    jobType: ['', Validators.required],
    status: ['NOT_CONFIGURED' as PlatformJobStatus, Validators.required],
    owner: [''],
    notes: ['']
  });

  readonly apiForm = this.fb.nonNullable.group({
    apiName: ['', Validators.required],
    basePath: ['', Validators.required],
    endpointCount: [0, Validators.min(0)],
    version: [''],
    authenticationRequired: [true],
    status: ['UNKNOWN' as ApiRegistryStatus, Validators.required],
    averageResponseTimeMs: ['']
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.platformOverview().subscribe({
      next: (overview) => this.overview.set(overview),
      error: () => this.error.set('Unable to load platform administration data.'),
      complete: () => this.loading.set(false)
    });
  }

  saveEnvironment(): void {
    if (this.environmentForm.invalid || !this.canManage()) return;
    this.api.createPlatformEnvironment(this.clean(this.environmentForm.getRawValue())).subscribe(this.afterSave('Environment recorded.'));
  }

  saveService(): void {
    if (this.serviceForm.invalid || !this.canManage()) return;
    this.api.createPlatformService(this.clean(this.serviceForm.getRawValue())).subscribe(this.afterSave('Service recorded.'));
  }

  saveRelease(): void {
    if (this.releaseForm.invalid || !this.canManage()) return;
    this.api.createPlatformRelease(this.clean(this.releaseForm.getRawValue())).subscribe(this.afterSave('Release recorded.'));
  }

  saveBackup(): void {
    if (this.backupForm.invalid || !this.canManage()) return;
    const value = this.clean(this.backupForm.getRawValue());
    if (value['backupSizeBytes']) value['backupSizeBytes'] = Number(value['backupSizeBytes']);
    this.api.createPlatformBackup(value).subscribe(this.afterSave('Backup record saved.'));
  }

  saveJob(): void {
    if (this.jobForm.invalid || !this.canManage()) return;
    this.api.createPlatformJob(this.clean(this.jobForm.getRawValue())).subscribe(this.afterSave('Job recorded.'));
  }

  saveApi(): void {
    if (this.apiForm.invalid || !this.canManage()) return;
    const value = this.clean(this.apiForm.getRawValue());
    if (value['averageResponseTimeMs']) value['averageResponseTimeMs'] = Number(value['averageResponseTimeMs']);
    this.api.createPlatformApi(value).subscribe(this.afterSave('API recorded.'));
  }

  formatDate(value?: string): string {
    if (!value) return 'No information has been added yet.';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  private afterSave(message: string) {
    return {
      next: () => {
        this.success.set(message);
        this.load();
      },
      error: () => this.error.set('Platform administration record could not be saved.')
    };
  }

  private clean<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typeof entry === 'string' && entry.trim() === '' ? undefined : entry]));
  }
}
