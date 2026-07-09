import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/models/auth.models';
import { ApiService } from '../../core/http/api.service';
import { WorkspaceRecord } from '../../core/models/api.models';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

@Component({
  selector: 'kravia-record-page',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './record-page.component.html'
})
export class RecordPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  readonly records = signal<WorkspaceRecord[]>([]);
  readonly loading = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly error = signal('');
  readonly success = signal('');
  readonly query = signal('');
  readonly statusFilter = signal('');

  readonly title = this.route.snapshot.data['title'] as string;
  readonly path = this.route.snapshot.data['path'] as string;
  readonly empty = this.route.snapshot.data['empty'] as string;
  readonly writeRoles = (this.route.snapshot.data['writeRoles'] as Role[] | undefined) ?? ['FOUNDER', 'DIRECTOR'];
  readonly archiveRoles = (this.route.snapshot.data['archiveRoles'] as Role[] | undefined) ?? ['FOUNDER'];
  readonly canWrite = computed(() => this.auth.hasAnyRole(this.writeRoles));
  readonly canArchive = computed(() => this.auth.hasAnyRole(this.archiveRoles));
  readonly statusOptions = ['DRAFT', 'ACTIVE', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'ARCHIVED'];

  readonly visibleRecords = computed(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.records().filter((record) => {
      const matchesTerm = !term || [record.title, record.status, record.ownerName, record.category, record.referenceCode, record.details, record.notes]
        .some((value) => value?.toLowerCase().includes(term));
      const matchesStatus = !status || record.status === status;
      return !record.archived && matchesTerm && matchesStatus;
    });
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    status: ['ACTIVE', Validators.required],
    ownerName: [''],
    dueDate: [''],
    category: [''],
    referenceCode: [''],
    amount: [null as number | null],
    details: [''],
    notes: ['']
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.list<WorkspaceRecord>(this.path).subscribe({
      next: (records) => this.records.set(records),
      error: () => this.error.set('Unable to load records.'),
      complete: () => this.loading.set(false)
    });
  }

  edit(record: WorkspaceRecord): void {
    if (!this.canWrite()) return;
    this.editingId.set(record.id);
    this.form.patchValue(record as never);
  }

  cancel(): void {
    this.editingId.set(null);
    this.form.reset({ title: '', status: 'ACTIVE', ownerName: '', dueDate: '', category: '', referenceCode: '', amount: null, details: '', notes: '' });
  }

  save(): void {
    if (this.form.invalid || !this.canWrite()) return;
    this.error.set('');
    this.success.set('');
    const id = this.editingId();
    const request = id ? this.api.update<WorkspaceRecord>(this.path, id, this.form.getRawValue()) : this.api.create<WorkspaceRecord>(this.path, this.form.getRawValue());
    request.subscribe({
      next: () => {
        this.success.set('Record saved.');
        this.cancel();
        this.load();
      },
      error: () => this.error.set('Record could not be saved.')
    });
  }

  archive(record: WorkspaceRecord): void {
    if (!this.canArchive()) return;
    this.api.archive(this.path, record.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('Record could not be archived.')
    });
  }
}
