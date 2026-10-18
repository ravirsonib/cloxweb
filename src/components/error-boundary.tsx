import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui';

type Props = {
  children: ReactNode;
  title?: string;
  homeHref?: string;
};

type State = {
  error: Error | null;
};

function ErrorFallback({
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

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error boundary', error, info.componentStack);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <ErrorFallback
        title={this.props.title}
        homeHref={this.props.homeHref}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}
