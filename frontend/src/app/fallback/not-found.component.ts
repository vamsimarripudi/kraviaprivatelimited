import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'kravia-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="portal-section fallback-page">
      <div class="panel state-panel">
        <p class="overline">Not Found</p>
        <strong>This page is not available.</strong>
        <p>The requested workspace route does not exist or is no longer available.</p>
        <a class="primary-button" routerLink="/company-profile">Return to workspace</a>
      </div>
    </section>
  `
})
export class NotFoundComponent {}
