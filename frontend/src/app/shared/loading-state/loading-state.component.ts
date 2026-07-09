import { Component, input } from '@angular/core';

@Component({
  selector: 'kravia-loading-state',
  standalone: true,
  template: '<div class="state-panel loading-state" role="status"><span></span><p>{{ message() }}</p></div>'
})
export class LoadingStateComponent {
  message = input('Loading...');
}
