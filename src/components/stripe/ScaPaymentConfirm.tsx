import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Notice } from '@/components/ui';
import { getStripe } from '@/lib/stripe';

/** Completes a PaymentIntent that requires SCA (3DS) using Stripe.js. */
export function ScaPaymentConfirm({
  clientSecret,
  publishableKey,
  onSucceeded,
  onCancel,
}: {
  clientSecret: string;
  publishableKey: string;
  onSucceeded: () => Promise<void> | void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
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

  return (
    <div className="space-y-3">
      <Notice tone="warn" title={t('jobs.scaTitle')}>
        <p className="text-sm">{t('jobs.scaBody')}</p>
      </Notice>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="cta" disabled={busy} onClick={() => void run()}>
          {busy ? t('jobs.scaConfirming') : t('jobs.scaConfirmCta')}
        </Button>
        {onCancel ? (
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            {t('confirm.cancel')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
