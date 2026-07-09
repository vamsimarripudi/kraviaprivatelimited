import { Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../core/http/api.service';
import { NotificationRecord } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

@Component({
  selector: 'kravia-notifications',
  standalone: true,
  imports: [EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './notifications.component.html'
})
export class NotificationsComponent {
  private readonly api = inject(ApiService);

  readonly notifications = signal<NotificationRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly selected = signal<NotificationRecord | null>(null);
  readonly unreadCount = computed(() => this.notifications().filter((item) => !item.read).length);

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.notifications().subscribe({
      next: (records) => {
        this.notifications.set(records);
        const selectedId = this.selected()?.id;
        this.selected.set(records.find((item) => item.id === selectedId) ?? records[0] ?? null);
      },
      error: () => this.error.set('Unable to load notifications.'),
      complete: () => this.loading.set(false)
    });
  }

  select(record: NotificationRecord): void { this.selected.set(record); }

  markRead(record: NotificationRecord): void {
    if (record.read) return;
    this.api.markNotificationRead(record.id).subscribe({
      next: (updated) => {
        this.selected.set(updated);
        this.success.set('Notification marked read.');
        this.load();
      },
      error: () => this.error.set('Notification could not be marked read.')
    });
  }

  markAllRead(): void {
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        this.success.set('Notifications marked read.');
        this.load();
      },
      error: () => this.error.set('Notifications could not be marked read.')
    });
  }

  archive(record: NotificationRecord): void {
    this.api.archiveNotification(record.id).subscribe({
      next: () => {
        this.success.set('Notification archived.');
        this.load();
      },
      error: () => this.error.set('Notification could not be archived.')
    });
  }

  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }
  formatDateTime(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.'; }
}