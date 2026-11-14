import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui';

export type ErrorBoundaryVariant = 'app' | 'page' | 'panel';

type Props = {
  children: ReactNode;
  /** `app` = full-screen last resort; `page` = main content only; `panel` = one section. */
  variant?: ErrorBoundaryVariant;
  title?: string;
  homeHref?: string;
};

type State = {
  error: Error | null;
};

function AppErrorFallback({
  title,
  homeHref = '/',
  onRetry,
}: {
  title?: string;
  homeHref?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation('common');
  return (
    <main className="flex min-h-screen items-center justify-center bg-clox-bg px-6 text-clox-text">
      <div className="clox-card w-full max-w-md p-8 text-center shadow-clox-2">
        <div className="flex justify-center">
          <BrandLogo variant="default" className="h-9 w-auto object-contain" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold text-clox-ink">
          {title ?? t('errorTitle')}
        </h1>
        <p className="mt-3 text-sm text-clox-mute">{t('errorBody')}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="cta" onClick={onRetry}>
            {t('tryAgain')}
          </Button>
          <a href={homeHref} className="clox-btn clox-btn-secondary">
            {t('goHome')}
          </a>
        </div>
      </div>
    </main>
  );
}

function PageErrorFallback({
  title,
  homeHref = '/',
  onRetry,
}: {
  title?: string;
  homeHref?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation('common');
  return (
    <div className="clox-card mx-auto max-w-lg p-6 text-center shadow-clox-1 sm:p-8">
      <h1 className="font-display text-xl font-bold text-clox-ink sm:text-2xl">
        {title ?? t('errorPageTitle', { defaultValue: t('errorTitle') })}
      </h1>
      <p className="mt-3 text-sm text-clox-mute">
        {t('errorPageBody', {
          defaultValue:
            'This page failed to load. Try again, or use the navigation to open another screen.',
        })}
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="cta" onClick={onRetry}>
          {t('tryAgain')}
        </Button>
        <a href={homeHref} className="clox-btn clox-btn-secondary">
          {t('goHome')}
        </a>
      </div>
    </div>
  );
}

function PanelErrorFallback({
  title,
  onRetry,
}: {
  title?: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation('common');
  return (
    <div
      className="rounded-xl border border-clox-border-soft bg-clox-surface-alt/50 px-4 py-5 text-center"
      role="alert"
    >
      <p className="text-sm font-semibold text-clox-ink">
        {title ??
          t('errorPanelTitle', {
            defaultValue: "Couldn't show this section",
          })}
      </p>
      <p className="mt-1.5 text-xs text-clox-mute">
        {t('errorPanelBody', {
          defaultValue: 'Try again. The rest of the page should still work.',
        })}
      </p>
      <div className="mt-4 flex justify-center">
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {t('tryAgain')}
        </Button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const variant = this.props.variant ?? 'app';
    console.error(`UI error boundary (${variant})`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const variant = this.props.variant ?? 'app';
    const onRetry = () => this.setState({ error: null });

    if (variant === 'panel') {
      return <PanelErrorFallback title={this.props.title} onRetry={onRetry} />;
    }

    if (variant === 'page') {
      return (
        <PageErrorFallback
          title={this.props.title}
          homeHref={this.props.homeHref}
          onRetry={onRetry}
        />
      );
    }

    return (
      <AppErrorFallback
        title={this.props.title}
        homeHref={this.props.homeHref}
        onRetry={onRetry}
      />
    );
  }
}

/**
 * Isolates one route’s main content. Remounts on path change so a prior crash
 * does not stick after navigation. Shell chrome stays up.
 */
export function PageErrorBoundary({
  children,
  title,
  homeHref,
}: {
  children: ReactNode;
  title?: string;
  homeHref?: string;
}) {
  const location = useLocation();
  return (
    <ErrorBoundary
      key={location.pathname}
      variant="page"
      title={title}
      homeHref={homeHref}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Isolates a list/widget so one section failure does not blank the page. */
export function PanelErrorBoundary({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  return (
    <ErrorBoundary variant="panel" title={title}>
      {children}
    </ErrorBoundary>
  );
}
