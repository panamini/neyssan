import * as Sentry from '@sentry/react';

export function initializeSentry(): void {
  Sentry.init({
    dsn: 'https://f5ae8289a5e6a4e87f860d70330db5bd@o4508784604938240.ingest.de.sentry.io/4508784612999248', // SENTRY_DSN from docs/key.md
    integrations: [],
    // Enable performance monitoring
    tracesSampleRate: 1.0,
    // Enable session replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
