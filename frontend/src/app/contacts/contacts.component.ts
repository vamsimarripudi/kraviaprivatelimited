import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { ContactCategory, ContactRecord, ContactRequest, ContactStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const CONTACT_CATEGORIES: Array<{ value: ContactCategory; label: string }> = [
  { value: 'CA', label: 'CA' },
  { value: 'LAWYER', label: 'Lawyer' },
  { value: 'BANK_MANAGER', label: 'Bank Manager' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'INVESTOR', label: 'Investor' },
  { value: 'GOVERNMENT_CONTACT', label: 'Government Contact' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'ADVISOR', label: 'Advisor' },
  { value: 'CONSULTANT', label: 'Consultant' },
  { value: 'OTHER', label: 'Other' }
];

const CONTACT_STATUSES: Array<{ value: ContactStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'WAITING', label: 'Waiting' },
  { value: 'FOLLOW_UP_NEEDED', label: 'Follow-up Needed' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ARCHIVED', label: 'Archived' }
];

@Component({
  selector: 'kravia-contacts',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './contacts.component.html'
})
export class ContactsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly categories = CONTACT_CATEGORIES;
  readonly statuses = CONTACT_STATUSES;
  readonly contacts = signal<ContactRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly category = signal<ContactCategory | ''>('');
  readonly status = signal<ContactStatus | ''>('');
  readonly selected = signal<ContactRecord | null>(null);
  readonly editingId = signal<string | null>(null);

  readonly canEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.category() || this.status()));
  readonly summaryCards = computed(() => {
    const contacts = this.contacts();
    return [
      { label: 'Important Contacts', value: contacts.filter((contact) => contact.status !== 'ARCHIVED').length, tone: 'neutral' },
      { label: 'Follow-ups Due', value: contacts.filter((contact) => contact.followUpDue).length, tone: 'critical' },
      { label: 'Waiting Responses', value: contacts.filter((contact) => contact.status === 'WAITING').length, tone: 'warning' },
      { label: 'Active Partners', value: contacts.filter((contact) => contact.status === 'ACTIVE').length, tone: 'positive' }
    ];
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    organization: ['', Validators.maxLength(255)],
    role: ['', Validators.maxLength(255)],
    category: ['OTHER' as ContactCategory, Validators.required],
    phone: ['', Validators.maxLength(60)],
    email: ['', [Validators.email, Validators.maxLength(255)]],
    notes: ['', Validators.maxLength(4000)],
    relatedDocumentId: [''],
    relatedTaskId: [''],
    lastContactedDate: [''],
    nextFollowUpDate: [''],
    status: ['ACTIVE' as ContactStatus, Validators.required]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.contacts({ query: this.query(), category: this.category(), status: this.status() }).subscribe({
      next: (contacts) => {
        this.contacts.set(contacts);
        const selectedId = this.selected()?.id;
        this.selected.set(contacts.find((contact) => contact.id === selectedId) ?? contacts[0] ?? null);
      },
      error: () => this.error.set('Unable to load contacts.'),
      complete: () => this.loading.set(false)
    });
  }

  applySearch(value: string): void { this.query.set(value); this.load(); }
  applyCategory(value: string): void { this.category.set(value as ContactCategory | ''); this.load(); }
  applyStatus(value: string): void { this.status.set(value as ContactStatus | ''); this.load(); }

  clearFilters(): void {
    this.query.set('');
    this.category.set('');
    this.status.set('');
    this.load();
  }

  select(contact: ContactRecord): void {
    this.selected.set(contact);
    if (this.editingId() !== contact.id) this.editingId.set(null);
  }

  startEdit(contact: ContactRecord): void {
    if (!this.canEditContact(contact)) return;
    this.select(contact);
    this.editingId.set(contact.id);
    this.form.reset({
      name: contact.name,
      organization: contact.organization ?? '',
      role: contact.role ?? '',
      category: contact.category,
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      notes: contact.notes ?? '',
      relatedDocumentId: contact.relatedDocumentId ?? '',
      relatedTaskId: contact.relatedTaskId ?? '',
      lastContactedDate: contact.lastContactedDate ?? '',
      nextFollowUpDate: contact.nextFollowUpDate ?? '',
      status: contact.status
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

    const validation = this.validationMessage();
    if (validation) {
      this.error.set(validation);
      return;
    }

    const payload = this.payload();
    this.error.set('');
    this.success.set('');
    const editingId = this.editingId();
    const request = editingId ? this.api.updateContact(editingId, payload) : this.api.createContact(payload);
    request.subscribe({
      next: (contact) => {
        this.selected.set(contact);
        this.editingId.set(null);
        this.resetForm();
        this.success.set(editingId ? 'Contact saved.' : 'Contact created.');
        this.load();
      },
      error: () => this.error.set(editingId ? 'Contact could not be saved.' : 'Contact could not be created.')
    });
  }

  archive(contact: ContactRecord): void {
    if (!this.canArchive() || contact.status === 'ARCHIVED') return;
    this.error.set('');
    this.success.set('');
    this.api.archiveContact(contact.id).subscribe({
      next: () => {
        this.success.set('Contact archived.');
        this.load();
      },
      error: () => this.error.set('Contact could not be archived.')
    });
  }

  canEditContact(contact: ContactRecord): boolean { return this.canEdit() && contact.status !== 'ARCHIVED'; }
  categoryLabel(value: ContactCategory): string { return this.categories.find((category) => category.value === value)?.label ?? value; }
  statusLabel(value: ContactStatus): string { return this.statuses.find((status) => status.value === value)?.label ?? value; }
  emptyText(value?: string): string { return value?.trim() ? value : 'No information has been added yet.'; }
  formatDate(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value + 'T00:00:00')) : 'No information has been added yet.'; }
  formatDateTime(value?: string): string { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.'; }

  followUpLabel(contact: ContactRecord): string {
    if (!contact.nextFollowUpDate) return 'No information has been added yet.';
    if (contact.followUpDue && contact.daysUntilFollowUp === 0) return 'Due today';
    if (contact.followUpDue) return 'Overdue by ' + Math.abs(contact.daysUntilFollowUp ?? 0) + ' day(s)';
    return 'Due in ' + contact.daysUntilFollowUp + ' day(s)';
  }

  private payload(): ContactRequest {
    const values = this.form.getRawValue();
    return {
      name: values.name.trim(),
      organization: values.organization.trim() || undefined,
      role: values.role.trim() || undefined,
      category: values.category,
      phone: values.phone.trim() || undefined,
      email: values.email.trim() || undefined,
      notes: values.notes.trim() || undefined,
      relatedDocumentId: values.relatedDocumentId.trim() || undefined,
      relatedTaskId: values.relatedTaskId.trim() || undefined,
      lastContactedDate: values.lastContactedDate || undefined,
      nextFollowUpDate: values.nextFollowUpDate || undefined,
      status: values.status
    };
  }

  private validationMessage(): string {
    const values = this.form.getRawValue();
    if (!values.phone.trim() && !values.email.trim()) return 'At least one contact method is required.';
    if (values.status === 'FOLLOW_UP_NEEDED' && !values.nextFollowUpDate) return 'Next follow-up date is required when follow-up is needed.';
    return '';
  }

  private resetForm(): void {
    this.form.reset({
      name: '',
      organization: '',
      role: '',
      category: 'OTHER',
      phone: '',
      email: '',
      notes: '',
      relatedDocumentId: '',
      relatedTaskId: '',
      lastContactedDate: '',
      nextFollowUpDate: '',
      status: 'ACTIVE'
    });
  }
}