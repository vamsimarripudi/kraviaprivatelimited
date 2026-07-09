import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/http/api.service';
import { SearchResult } from '../core/models/api.models';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';

@Component({
  selector: 'kravia-search',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent],
  templateUrl: './search.component.html'
})
export class SearchComponent {
  private readonly api = inject(ApiService);
  readonly query = signal('');
  readonly results = signal<SearchResult[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly hasQuery = computed(() => this.query().trim().length > 1);

  search(): void {
    const q = this.query().trim();
    if (q.length < 2) {
      this.results.set([]);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api.search(q).subscribe({
      next: (results) => this.results.set(results),
      error: () => this.error.set('Search could not be completed.'),
      complete: () => this.loading.set(false)
    });
  }
}
