import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'kravia-error-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="portal-section fallback-page">
      <div class="panel state-panel">
        <p class="overline">Application Error</p>
        <strong>Something went wrong.</strong>
        <p>No sensitive error details are shown here. Please try again or contact the KRAVIA administrator.</p>
        <a class="primary-button" routerLink="/company-profile">Return to workspace</a>
      </div>
    </section>
  `
})
export class ErrorPageComponent {}
