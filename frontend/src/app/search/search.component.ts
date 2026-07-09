import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/http/api.service';
import { SearchResponse } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingStateComponent } from '../shared/loading-state/loading-state.component';
import { ErrorStateComponent } from '../shared/error-state/error-state.component';

@Component({
  selector: 'kravia-search',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent, LoadingStateComponent, ErrorStateComponent],
  templateUrl: './search.component.html'
})
export class SearchComponent {
  private readonly api = inject(ApiService);

  readonly query = signal('');
  readonly response = signal<SearchResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly searched = signal(false);
  readonly totalResults = computed(() => this.response()?.totalResults ?? 0);

  search(): void {
    const value = this.query().trim();
    this.error.set('');
    this.searched.set(true);
    if (!value) {
      this.response.set({ query: '', searchedAt: new Date().toISOString(), totalResults: 0, groups: [] });
      return;
    }
    this.loading.set(true);
    this.api.globalSearch(value).subscribe({
      next: (response) => this.response.set(response),
      error: () => this.error.set('Unable to search records.'),
      complete: () => this.loading.set(false)
    });
  }

  updateQuery(value: string): void { this.query.set(value); }

  formatDateTime(value?: string): string {
    return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'No information has been added yet.';
  }
}
