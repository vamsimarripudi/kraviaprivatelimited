import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { AnnouncementAudience, AnnouncementRecord, AnnouncementRequest, AnnouncementStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const AUDIENCES: Array<{ value: AnnouncementAudience; label: string }> = [
  { value: 'EVERYONE', label: 'Everyone' },
  { value: 'FOUNDER', label: 'Founder' },
  { value: 'DIRECTOR', label: 'Director' },
  { value: 'VIEWER', label: 'Viewer' }
];

const STATUSES: Array<{ value: AnnouncementStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'PINNED', label: 'Pinned' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'ARCHIVED', label: 'Archived' }
];

@Component({
  selector: 'kravia-announcements',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './announcements.component.html'
})
export class AnnouncementsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly audiences = AUDIENCES;
  readonly statuses = STATUSES;
  readonly announcements = signal<AnnouncementRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly selected = signal<AnnouncementRecord | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly summaryCards = computed(() => {
    const records = this.announcements();
    return [
      { label: 'Published', value: records.filter((item) => item.status === 'PUBLISHED').length, tone: 'positive' },
      { label: 'Pinned', value: records.filter((item) => item.status === 'PINNED').length, tone: 'warning' },
      { label: 'Drafts', value: records.filter((item) => item.status === 'DRAFT').length, tone: 'neutral' },
      { label: 'Archived', value: records.filter((item) => item.status === 'ARCHIVED').length, tone: 'critical' }
    ];
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    message: ['', [Validators.required, Validators.maxLength(6000)]],
    audience: ['EVERYONE' as AnnouncementAudience, Validators.required],
    status: ['DRAFT' as AnnouncementStatus, Validators.required],
    expiresAt: ['']
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.announcements().subscribe({
      next: (records) => {
        this.announcements.set(records);
        const selectedId = this.selected()?.id;
        this.selected.set(records.find((item) => item.id === selectedId) ?? records[0] ?? null);
      },
      error: () => this.error.set('Unable to load announcements.'),
      complete: () => this.loading.set(false)
    });
  }

  select(record: AnnouncementRecord): void {
    this.selected.set(record);
    if (this.editingId() !== record.id) this.editingId.set(null);
  }

  startEdit(record: AnnouncementRecord): void {
    if (!this.canEditRecord(record)) return;
    this.select(record);
    this.editingId.set(record.id);
    this.form.reset({
      title: record.title,
      message: record.message,
      audience: record.audience,
      status: record.status,
      expiresAt: record.expiresAt ?? ''
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  submit(): void {
    if (!this.canEdit()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.payload();
    this.error.set('');
    this.success.set('');
    const editingId = this.editingId();
    const request = editingId ? this.api.updateAnnouncement(editingId, payload) : this.api.createAnnouncement(payload);
    request.subscribe({
      next: (record) => {
        this.selected.set(record);
        this.editingId.set(null);
        this.resetForm();
        this.success.set(editingId ? 'Announcement saved.' : 'Announcement created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Announcement could not be saved.' : 'Announcement could not be created.')
    });
  }

  pin(record: AnnouncementRecord): void {
    if (!this.canEditRecord(record)) return;
    this.error.set('');
    this.success.set('');
    this.api.pinAnnouncement(record.id).subscribe({
      next: (updated) => {
        this.selected.set(updated);
        this.success.set('Announcement pinned.');
        this.load();
      },
      error: () => this.error.set('Announcement could not be pinned.')
    });
  }

  archive(record: AnnouncementRecord): void {
    if (!this.canArchive() || record.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveAnnouncement(record.id).subscribe({
      next: () => {
        this.success.set('Announcement archived.');
        this.load();
      },
      error: () => this.error.set('Announcement could not be archived.')
    });
  }

  canEditRecord(record: AnnouncementRecord): boolean { return this.canEdit() && record.status !== 'ARCHIVED'; }
  audienceLabel(value: AnnouncementAudience): string { return this.audiences.find((item) => item.value === value)?.label ?? value; }
  statusLabel(value: AnnouncementStatus): string { return this.statuses.find((item) => item.value === value)?.label ?? value; }
  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }
  formatDate(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00')) : 'No information has been added yet.'; }
  formatDateTime(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.'; }

  private payload(): AnnouncementRequest {
    const values = this.form.getRawValue();
    return {
      title: values.title.trim(),
      message: values.message.trim(),
      audience: values.audience,
      status: values.status,
      expiresAt: values.expiresAt || undefined
    };
  }

  private resetForm(): void {
    this.form.reset({ title: '', message: '', audience: 'EVERYONE', status: 'DRAFT', expiresAt: '' });
  }
}