import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { BoardMeetingRecord, BoardMeetingRequest, MeetingActionItemRecord, MeetingActionItemRequest, MeetingActionItemStatus, MeetingStatus, MeetingType } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const MEETING_TYPES: Array<{ value: MeetingType; label: string }> = [
  { value: 'BOARD_MEETING', label: 'Board Meeting' },
  { value: 'FOUNDER_MEETING', label: 'Founder Meeting' },
  { value: 'FINANCE_REVIEW', label: 'Finance Review' },
  { value: 'COMPLIANCE_REVIEW', label: 'Compliance Review' },
  { value: 'PRODUCT_REVIEW', label: 'Product Review' },
  { value: 'BANK_MEETING', label: 'Bank Meeting' },
  { value: 'INVESTOR_MEETING', label: 'Investor Meeting' },
  { value: 'OTHER', label: 'Other' }
];

const MEETING_STATUSES: Array<{ value: MeetingStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ARCHIVED', label: 'Archived' }
];

const ACTION_STATUSES: Array<{ value: MeetingActionItemStatus; label: string }> = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' }
];

@Component({
  selector: 'kravia-board-meetings',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './board-meetings.component.html'
})
export class BoardMeetingsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly meetingTypes = MEETING_TYPES;
  readonly meetingStatuses = MEETING_STATUSES;
  readonly actionStatuses = ACTION_STATUSES;

  readonly meetings = signal<BoardMeetingRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly actionError = signal('');
  readonly query = signal('');
  readonly meetingType = signal<MeetingType | ''>('');
  readonly status = signal<MeetingStatus | ''>('');
  readonly selected = signal<BoardMeetingRecord | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly actionEditingId = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.meetingType() || this.status()));

  readonly meetingForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    meetingDate: ['', Validators.required],
    meetingType: ['BOARD_MEETING' as MeetingType, Validators.required],
    status: ['DRAFT' as MeetingStatus, Validators.required],
    agendaItems: [''],
    discussionNotes: [''],
    decisions: [''],
    resolutions: ['']
  });

  readonly actionForm = this.fb.nonNullable.group({
    actionText: ['', Validators.required],
    owner: ['', Validators.required],
    dueDate: [''],
    status: ['TODO' as MeetingActionItemStatus, Validators.required]
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.boardMeetings({ query: this.query(), meetingType: this.meetingType(), status: this.status() }).subscribe({
      next: (meetings) => {
        this.meetings.set(meetings);
        const selectedId = this.selected()?.id;
        this.selected.set(meetings.find((meeting) => meeting.id === selectedId) ?? meetings[0] ?? null);
      },
      error: () => this.error.set('Unable to load board meetings.'),
      complete: () => this.loading.set(false)
    });
  }

  applySearch(value: string): void {
    this.query.set(value);
    this.load();
  }

  applyType(value: string): void {
    this.meetingType.set(value as MeetingType | '');
    this.load();
  }

  applyStatus(value: string): void {
    this.status.set(value as MeetingStatus | '');
    this.load();
  }

  clearFilters(): void {
    this.query.set('');
    this.meetingType.set('');
    this.status.set('');
    this.load();
  }

  select(meeting: BoardMeetingRecord): void {
    this.selected.set(meeting);
    if (this.editingId() !== meeting.id) this.editingId.set(null);
    this.cancelActionEdit();
  }

  startEdit(meeting: BoardMeetingRecord): void {
    if (!this.canEditMeeting(meeting)) return;
    this.select(meeting);
    this.editingId.set(meeting.id);
    this.meetingForm.reset({
      title: meeting.title,
      meetingDate: this.toDateTimeLocal(meeting.meetingDate),
      meetingType: meeting.meetingType,
      status: meeting.status,
      agendaItems: meeting.agendaItems.join('\n'),
      discussionNotes: meeting.discussionNotes ?? '',
      decisions: meeting.decisions.join('\n'),
      resolutions: meeting.resolutions.join('\n')
    });
  }

  cancelMeetingEdit(): void {
    this.editingId.set(null);
    this.resetMeetingForm();
  }

  submitMeeting(): void {
    if (!this.canEdit()) return;
    if (this.meetingForm.invalid) {
      this.meetingForm.markAllAsTouched();
      return;
    }

    const payload = this.meetingPayload();
    if (payload.status === 'COMPLETED' && payload.agendaItems.length === 0) {
      this.error.set('At least one agenda item is required before marking a meeting completed.');
      return;
    }

    this.error.set('');
    this.success.set('');
    const editingId = this.editingId();
    const request = editingId ? this.api.updateBoardMeeting(editingId, payload) : this.api.createBoardMeeting(payload);
    request.subscribe({
      next: (meeting) => {
        this.selected.set(meeting);
        this.editingId.set(null);
        this.resetMeetingForm();
        this.success.set(editingId ? 'Board meeting saved.' : 'Board meeting created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Board meeting could not be saved.' : 'Board meeting could not be created.')
    });
  }

  archive(meeting: BoardMeetingRecord): void {
    if (!this.canArchive() || meeting.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveBoardMeeting(meeting.id).subscribe({
      next: () => {
        this.success.set('Board meeting archived.');
        this.load();
      },
      error: () => this.error.set('Board meeting could not be archived.')
    });
  }

  startActionEdit(item: MeetingActionItemRecord): void {
    if (!this.selected() || !this.canEditMeeting(this.selected() as BoardMeetingRecord)) return;
    this.actionEditingId.set(item.id);
    this.actionError.set('');
    this.actionForm.reset({
      actionText: item.actionText,
      owner: item.owner,
      dueDate: item.dueDate ?? '',
      status: item.status
    });
  }

  cancelActionEdit(): void {
    this.actionEditingId.set(null);
    this.actionError.set('');
    this.actionForm.reset({ actionText: '', owner: '', dueDate: '', status: 'TODO' });
  }

  submitAction(): void {
    const meeting = this.selected();
    if (!meeting || !this.canEditMeeting(meeting)) return;
    if (this.actionForm.invalid) {
      this.actionForm.markAllAsTouched();
      return;
    }

    const payload = this.actionPayload();
    if (payload.status !== 'DONE' && !payload.dueDate) {
      this.actionError.set('Due date is required for active action items.');
      return;
    }

    this.actionError.set('');
    this.error.set('');
    this.success.set('');
    const actionId = this.actionEditingId();
    const request = actionId
      ? this.api.updateMeetingActionItem(meeting.id, actionId, payload)
      : this.api.addMeetingActionItem(meeting.id, payload);

    request.subscribe({
      next: () => {
        this.success.set(actionId ? 'Action item saved.' : 'Action item added.');
        this.cancelActionEdit();
        this.load();
      },
      error: () => this.actionError.set(actionId ? 'Action item could not be saved.' : 'Action item could not be added.')
    });
  }

  canEditMeeting(meeting: BoardMeetingRecord): boolean {
    return this.canEdit() && meeting.status !== 'ARCHIVED';
  }

  typeCount(type: MeetingType): number {
    return this.meetings().filter((meeting) => meeting.meetingType === type).length;
  }

  openActionCount(meeting: BoardMeetingRecord): number {
    return meeting.actionItems.filter((item) => item.status !== 'DONE').length;
  }

  typeLabel(value: MeetingType): string {
    return this.meetingTypes.find((type) => type.value === value)?.label ?? value;
  }

  statusLabel(value: MeetingStatus): string {
    return this.meetingStatuses.find((status) => status.value === value)?.label ?? value;
  }

  actionStatusLabel(value: MeetingActionItemStatus): string {
    return this.actionStatuses.find((status) => status.value === value)?.label ?? value;
  }

  formatDate(value: string): string {
    return value ? value.replace('T', ' ').slice(0, 16) : 'No information has been added yet.';
  }

  emptyText(value?: string): string {
    return value?.trim() ? value : 'No information has been added yet.';
  }

  private meetingPayload(): BoardMeetingRequest {
    const values = this.meetingForm.getRawValue();
    return {
      title: values.title.trim(),
      meetingDate: values.meetingDate,
      meetingType: values.meetingType,
      status: values.status,
      agendaItems: this.lines(values.agendaItems),
      discussionNotes: values.discussionNotes.trim() || undefined,
      decisions: this.lines(values.decisions),
      resolutions: this.lines(values.resolutions)
    };
  }

  private actionPayload(): MeetingActionItemRequest {
    const values = this.actionForm.getRawValue();
    return {
      actionText: values.actionText.trim(),
      owner: values.owner.trim(),
      dueDate: values.dueDate || undefined,
      status: values.status
    };
  }

  private resetMeetingForm(): void {
    this.meetingForm.reset({
      title: '',
      meetingDate: '',
      meetingType: 'BOARD_MEETING',
      status: 'DRAFT',
      agendaItems: '',
      discussionNotes: '',
      decisions: '',
      resolutions: ''
    });
  }

  private lines(value: string): string[] {
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  private toDateTimeLocal(value: string): string {
    return value ? value.slice(0, 16) : '';
  }
}
