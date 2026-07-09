import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { AuthService } from '../core/auth/auth.service';
import { DocumentRecord } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';

const DOCUMENT_CATEGORIES = [
  'Incorporation Certificate',
  'MOA',
  'AOA',
  'Company PAN',
  'TAN',
  'GST',
  'Board Resolutions',
  'Rental Agreement',
  'Bank Documents',
  'Trademark Documents',
  'Startup India Documents',
  'Agreements',
  'Other Documents'
];

@Component({
  selector: 'kravia-documents',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './documents.component.html'
})
export class DocumentsComponent {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly categories = DOCUMENT_CATEGORIES;
  readonly documents = signal<DocumentRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly selectedFile = signal<File | null>(null);
  readonly query = signal('');
  readonly category = signal('');
  readonly canUpload = computed(() => this.auth.hasAnyRole(['FOUNDER']));

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    category: [DOCUMENT_CATEGORIES[0], Validators.required],
    file: ['', Validators.required]
  });

  readonly filteredDocuments = computed(() => {
    const term = this.query().trim().toLowerCase();
    const category = this.category();
    return this.documents().filter((document) => {
      const matchesTerm = !term || [document.title, document.category, document.uploadedBy, document.status, document.versionLabel]
        .some((value) => value?.toLowerCase().includes(term));
      const matchesCategory = !category || document.category === category;
      return matchesTerm && matchesCategory;
    });
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.documents().subscribe({
      next: (documents) => this.documents.set(documents),
      error: () => this.error.set('Unable to load documents.'),
      complete: () => this.loading.set(false)
    });
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.form.controls.file.setValue(file?.name ?? '');
  }

  upload(): void {
    const file = this.selectedFile();
    if (this.form.invalid || !file || !this.canUpload()) return;
    this.error.set('');
    this.success.set('');
    const body = new FormData();
    body.append('title', this.form.controls.title.value);
    body.append('category', this.form.controls.category.value);
    body.append('file', file);
    this.api.uploadDocument(body).subscribe({
      next: () => {
        this.success.set('Document uploaded.');
        this.form.reset({ title: '', category: DOCUMENT_CATEGORIES[0], file: '' });
        this.selectedFile.set(null);
        this.load();
      },
      error: () => this.error.set('Document could not be uploaded.')
    });
  }

  download(document: DocumentRecord): void {
    window.open(`/api/documents/${document.id}/download`, '_blank', 'noopener');
  }
}
