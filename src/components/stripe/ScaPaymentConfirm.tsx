import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, Notice } from '@/components/ui';
import { formatDollars } from '@/lib/currency';
import { getStripe } from '@/lib/stripe';

function PaymentElementConfirmForm({
  amountIncGstCents,
  onSucceeded,
  onCancel,
}: {
  amountIncGstCents?: number;
  onSucceeded: () => Promise<void> | void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation('common');
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setError(null);
    setBusy(true);
    try {
      const result = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message ?? t('jobs.paymentFailed', { defaultValue: 'Payment could not be completed. Check your card details and try again.' }));
        return;
      }
      const status = result.paymentIntent?.status;
      if (status !== 'succeeded' && status !== 'processing') {
        setError(t('jobs.scaUnexpectedStatus', { status: status ?? 'unknown' }));
        return;
      }
      await onSucceeded();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('jobs.paymentFailed', { defaultValue: 'Payment could not be completed. Check your card details and try again.' }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/40">
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
          }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('jobs.paymentSaveCardHint', {
          defaultValue:
            'Your card will be securely saved via Stripe for future job bookings and approved trip surcharges.',
        })}
      </p>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-2.5">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onCancel}
          >
            {t('confirm.cancel')}
          </Button>
        ) : null}
        <Button type="submit" variant="cta" disabled={!stripe || busy}>
          {busy
            ? t('jobs.paymentProcessing', { defaultValue: 'Processing payment…' })
            : amountIncGstCents != null
              ? t('jobs.payAmountAndLock', {
                  amount: formatDollars(amountIncGstCents),
                  defaultValue: 'Pay {{amount}} & lock job',
                })
              : t('jobs.payAndLock', { defaultValue: 'Pay & lock job' })}
        </Button>
      </div>
    </form>
  );
}

/**
 * Completes a PaymentIntent on bid acceptance — either by collecting a card via
 * Stripe Payment Element (`requires_payment_method` / `requires_confirmation`)
 * or by running 3D Secure (`requires_action`) on an existing card.
 */
export function ScaPaymentConfirm({
  clientSecret,
  publishableKey,
  stripeStatus,
  amountIncGstCents,
  onSucceeded,
  onCancel,
}: {
  clientSecret: string;
  publishableKey: string;
  stripeStatus?: string;
  amountIncGstCents?: number;
  onSucceeded: () => Promise<void> | void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation('common');
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useNewCard, setUseNewCard] = useState(false);

  const showPaymentElement =
    useNewCard || stripeStatus !== 'requires_action';

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && onCancel) {
        event.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, onCancel]);

  const runSca = async () => {
    setError(null);
    setBusy(true);
    try {
      const stripe = await getStripe(publishableKey);
      if (!stripe) {
        setError(t('jobs.scaStripeMissing'));
        return;
      }
      const result = await stripe.confirmCardPayment(clientSecret);
      if (result.error) {
        if (result.error.payment_intent?.status === 'requires_payment_method') {
          setUseNewCard(true);
        }
        setError(result.error.message ?? t('jobs.scaFailed'));
        return;
      }
      const status = result.paymentIntent?.status;
      if (status !== 'succeeded' && status !== 'processing') {
        setError(t('jobs.scaUnexpectedStatus', { status: status ?? 'unknown' }));
        return;
      }
      await onSucceeded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('jobs.scaFailed'));
    } finally {
      setBusy(false);
    }
  };

  const stripePromise = getStripe(publishableKey);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy && onCancel) {
          onCancel();
        }
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a2f4c] p-6 shadow-2xl border border-slate-200 dark:border-slate-700/80 text-left animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className="font-display text-lg font-bold text-slate-900 dark:text-white"
            >
              {showPaymentElement
                ? t('jobs.paymentModalTitle', { defaultValue: 'Complete payment to lock assignment' })
                : t('jobs.scaTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {showPaymentElement
                ? t('jobs.paymentModalSubtitle', {
                    defaultValue:
                      'Enter your card details below to pay the accepted fare and lock the carrier for this shipment.',
                  })
                : t('jobs.scaBody')}
            </p>
          </div>
          {amountIncGstCents != null ? (
            <div className="shrink-0 rounded-lg bg-orange-50 px-3 py-1.5 text-right dark:bg-orange-950/40">
              <div className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('jobs.totalIncGstLabel', { defaultValue: 'Total (inc. GST)' })}
              </div>
              <div className="font-display text-base font-bold text-clox-orange">
                {formatDollars(amountIncGstCents)}
              </div>
            </div>
          ) : null}
        </div>

        {showPaymentElement ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              locale: 'en-AU',
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#e85d04',
                  borderRadius: '8px',
                },
              },
            }}
          >
            <PaymentElementConfirmForm
              amountIncGstCents={amountIncGstCents}
              onSucceeded={onSucceeded}
              onCancel={onCancel}
            />
          </Elements>
        ) : (
          <div className="mt-5 space-y-4">
            {error ? <Notice tone="error">{error}</Notice> : null}
            <div className="flex flex-wrap justify-end gap-2.5">
              {onCancel ? (
                <Button variant="secondary" disabled={busy} onClick={onCancel}>
                  {t('confirm.cancel')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setUseNewCard(true);
                }}
              >
                {t('jobs.useDifferentCard', { defaultValue: 'Use a different card' })}
              </Button>
              <Button variant="cta" disabled={busy} onClick={() => void runSca()}>
                {busy ? t('jobs.scaConfirming') : t('jobs.scaConfirmCta')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }
  return createPortal(modalContent, document.body);
}
