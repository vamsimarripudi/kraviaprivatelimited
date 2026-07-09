import { Component, input } from '@angular/core';

@Component({
  selector: 'kravia-empty-state',
  standalone: true,
  template: '<div class="state-panel empty-state"><p>{{ label() }}</p><strong>{{ message() }}</strong></div>'
})
export class EmptyStateComponent {
  label = input.required<string>();
  message = input('No information has been added yet.');
}
