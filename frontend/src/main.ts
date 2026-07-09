import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch(() => {
  document.body.innerHTML = '<main class="auth-page"><section class="state-panel error-state"><p>Application failed to start.</p></section></main>';
});
