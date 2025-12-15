import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_FIREBASE_ENV || 'development';

  if (!dsn) {
    console.warn('Sentry DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Session Replay
    replaysSessionSampleRate: environment === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,

    // Release tracking
    release: import.meta.env.VITE_RELEASE_VERSION || 'development',

    // Error filtering
    beforeSend(event) {
      // Filter out common noise
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error?.value?.includes('Network request failed')) {
          // Reduce noise from network errors
          event.fingerprint = ['network-error'];
        }
      }
      return event;
    },
  });

  // Set user context when available
  Sentry.setTag('app', 'credit-intelligence-center');
  Sentry.setTag('component', 'frontend');
};

export const setUserContext = (user: any) => {
  if (user) {
    Sentry.setUser({
      id: user.uid,
      email: user.email,
      username: user.displayName || user.email,
    });
    Sentry.setTag('user_role', user.role || 'unknown');
  } else {
    Sentry.setUser(null);
  }
};

export const captureException = (error: Error, context?: any) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
};

export const addBreadcrumb = (message: string, category: string, level: Sentry.SeverityLevel = 'info') => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
  });
};
