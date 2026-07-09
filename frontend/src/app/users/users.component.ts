import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { Role, UserAccount } from '../core/models/auth.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';

@Component({
  selector: 'kravia-users',
  standalone: true,
  imports: [ReactiveFormsModule, EmptyStateComponent],
  templateUrl: './users.component.html'
})
export class UsersComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  readonly users = signal<UserAccount[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly roles: Role[] = ['FOUNDER', 'DIRECTOR', 'VIEWER'];

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', Validators.required],
    role: ['VIEWER' as Role, Validators.required],
    password: ['', [Validators.required, Validators.minLength(12)]]
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.api.users().subscribe({
      next: (users) => this.users.set(users),
      error: () => this.error.set('Unable to load users.'),
      complete: () => this.loading.set(false)
    });
  }

  create(): void {
    if (this.form.invalid) return;
    this.error.set('');
    this.success.set('');
    this.api.createUser(this.form.getRawValue()).subscribe({
      next: () => {
        this.success.set('User account created.');
        this.form.reset({ email: '', displayName: '', role: 'VIEWER', password: '' });
        this.load();
      },
      error: () => this.error.set('User account could not be created.')
    });
  }

  disable(user: UserAccount): void {
    this.api.disableUser(user.id).subscribe({
      next: () => this.load(),
      error: () => this.error.set('User account could not be disabled.')
    });
  }
}
