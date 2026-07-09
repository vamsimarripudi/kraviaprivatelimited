import { Component, input } from '@angular/core';

@Component({
  selector: 'kravia-error-state',
  standalone: true,
  template: '<div class="state-panel error-state" role="alert"><p>{{ message() }}</p></div>'
})
export class ErrorStateComponent {
  message = input.required<string>();
}
