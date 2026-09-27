import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-clox-orange">
          {t('brand')}
        </p>
        <h1 className="mt-4 text-2xl font-bold">{title ?? t('errorTitle')}</h1>
        <p className="mt-3 text-sm text-slate-300">{t('errorBody')}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            className="rounded-xl bg-clox-orange px-4 py-2.5 text-sm font-semibold text-white"
            onClick={onRetry}
          >
            {t('tryAgain')}
          </button>
          <a
            href={homeHref}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white"
          >
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
