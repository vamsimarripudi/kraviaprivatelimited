import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpEventType, HttpResponse } from '@angular/common/http';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { DocumentCategory, DocumentRecord, DocumentStatus } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

const DOCUMENT_CATEGORIES: Array<{ value: DocumentCategory; label: string }> = [
  { value: 'INCORPORATION_CERTIFICATE', label: 'Incorporation Certificate' },
  { value: 'MOA', label: 'MOA' },
  { value: 'AOA', label: 'AOA' },
  { value: 'COMPANY_PAN', label: 'Company PAN' },
  { value: 'TAN', label: 'TAN' },
  { value: 'GST', label: 'GST' },
  { value: 'BOARD_RESOLUTION', label: 'Board Resolution' },
  { value: 'RENTAL_AGREEMENT', label: 'Rental Agreement' },
  { value: 'BANK_DOCUMENT', label: 'Bank Document' },
  { value: 'TRADEMARK_DOCUMENT', label: 'Trademark Document' },
  { value: 'STARTUP_INDIA_DOCUMENT', label: 'Startup India Document' },
  { value: 'AGREEMENT', label: 'Agreement' },
  { value: 'OTHER', label: 'Other' }
];

const DOCUMENT_STATUSES: Array<{ value: DocumentStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'PENDING_REVIEW', label: 'Pending review' }
];

@Component({
  selector: 'kravia-documents',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './documents.component.html'
})
export class DocumentsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly categories = DOCUMENT_CATEGORIES;
  readonly statuses = DOCUMENT_STATUSES;
  readonly documents = signal<DocumentRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly category = signal<DocumentCategory | ''>('');
  readonly status = signal<DocumentStatus | ''>('');
  readonly selected = signal<DocumentRecord | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadProgress = signal(0);

  readonly canUploadEdit = computed(() => this.auth.hasAnyRole(['FOUNDER', 'DIRECTOR']));
  readonly canArchive = computed(() => this.auth.hasAnyRole(['FOUNDER']));
  readonly activeFilters = computed(() => Boolean(this.query().trim() || this.category() || this.status()));

  readonly uploadForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    category: ['OTHER' as DocumentCategory, Validators.required],
    description: ['']
  });

  readonly editForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    category: ['OTHER' as DocumentCategory, Validators.required],
    description: [''],
    status: ['ACTIVE' as DocumentStatus, Validators.required]
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.documents({ query: this.query(), category: this.category(), status: this.status() }).subscribe({
      next: (documents) => {
        this.documents.set(documents);
        const selectedId = this.selected()?.id;
        this.selected.set(documents.find((document) => document.id === selectedId) ?? documents[0] ?? null);
      },
      error: () => this.error.set('Unable to load documents.'),
      complete: () => this.loading.set(false)
    });
  }

  applySearch(value: string): void {
    this.query.set(value);
    this.load();
  }

  applyCategory(value: string): void {
    this.category.set(value as DocumentCategory | '');
    this.load();
  }

  applyStatus(value: string): void {
    this.status.set(value as DocumentStatus | '');
    this.load();
  }

  clearFilters(): void {
    this.query.set('');
    this.category.set('');
    this.status.set('');
    this.load();
  }

  categoryCount(category: DocumentCategory): number {
    return this.documents().filter((document) => document.category === category).length;
  }

  select(document: DocumentRecord): void {
    this.selected.set(document);
    if (this.editingId() !== document.id) this.editingId.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  upload(): void {
    if (this.uploadForm.invalid || !this.selectedFile() || !this.canUploadEdit()) {
      this.uploadForm.markAllAsTouched();
      return;
    }

    const payload = new FormData();
    const values = this.uploadForm.getRawValue();
    payload.append('title', values.title.trim());
    payload.append('category', values.category);
    payload.append('description', values.description.trim());
    payload.append('file', this.selectedFile() as File);

    this.error.set('');
    this.success.set('');
    this.uploading.set(true);
    this.uploadProgress.set(0);

    this.api.uploadDocument(payload).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((event.loaded / event.total) * 100));
        }
        if (event instanceof HttpResponse && event.body) {
          this.success.set('Document uploaded.');
          this.uploadForm.reset({ title: '', category: 'OTHER', description: '' });
          this.selectedFile.set(null);
          this.uploadProgress.set(100);
          this.load();
        }
      },
      error: () => {
        this.error.set('Document could not be uploaded.');
        this.uploading.set(false);
      },
      complete: () => this.uploading.set(false)
    });
  }

  startEdit(document: DocumentRecord): void {
    if (!this.canUploadEdit()) return;
    this.select(document);
    this.editingId.set(document.id);
    this.editForm.reset({
      title: document.title,
      category: document.category,
      description: document.description ?? '',
      status: document.status
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveMetadata(document: DocumentRecord): void {
    if (this.editForm.invalid || !this.canUploadEdit()) {
      this.editForm.markAllAsTouched();
      return;
    }

    const values = this.editForm.getRawValue();
    this.error.set('');
    this.success.set('');
    this.api.updateDocument(document.id, {
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim(),
      status: values.status
    }).subscribe({
      next: (updated) => {
        this.success.set('Document metadata saved.');
        this.editingId.set(null);
        this.documents.update((documents) => documents.map((item) => item.id === updated.id ? updated : item));
        this.selected.set(updated);
      },
      error: () => this.error.set('Document metadata could not be saved.')
    });
  }

  archive(document: DocumentRecord): void {
    if (!this.canArchive()) return;
    this.error.set('');
    this.success.set('');
    this.api.archiveDocument(document.id).subscribe({
      next: () => {
        this.success.set('Document archived.');
        this.load();
      },
      error: () => this.error.set('Document could not be archived.')
    });
  }

  download(document: DocumentRecord): void {
    this.error.set('');
    this.api.downloadDocument(document.id).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.error.set('Document file could not be downloaded.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');
        anchor.href = url;
        anchor.download = this.downloadName(response.headers.get('content-disposition')) || document.fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Document file could not be downloaded.')
    });
  }

  categoryLabel(value: DocumentCategory): string {
    return this.categories.find((category) => category.value === value)?.label ?? value;
  }

  statusLabel(value: DocumentStatus): string {
    return this.statuses.find((status) => status.value === value)?.label ?? value;
  }

  fileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private downloadName(contentDisposition: string | null): string {
    if (!contentDisposition) return '';
    const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return match?.[1] ?? '';
  }
}
