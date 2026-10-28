import { PaymentElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Notice } from '@/components/ui';
import { getStripe } from '@/lib/stripe';

type InnerProps = {
  onPaymentMethodReady: (paymentMethodId: string) => Promise<void>;
  submitting: boolean;
};

function SenderPaymentElementInner({ onPaymentMethodReady, submitting }: InnerProps) {
  const { t } = useTranslation();
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
      const result = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });
      if (result.error) {
        setError(result.error.message ?? t('senderOnboarding.paymentStripeError'));
        return;
      }
      const pm = result.setupIntent?.payment_method;
      const pmId = typeof pm === 'string' ? pm : pm?.id;
      if (!pmId) {
        setError(t('senderOnboarding.paymentMissingPm'));
        return;
      }
      await onPaymentMethodReady(pmId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('senderOnboarding.paymentStripeError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          paymentMethodOrder: ['card'],
        }}
      />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button type="submit" variant="cta" disabled={!stripe || busy || submitting}>
        {busy || submitting
          ? t('senderOnboarding.paymentSaving')
          : t('senderOnboarding.confirmPaymentReady')}
      </Button>
    </form>
  );
}

export function SenderPaymentElement({
  clientSecret,
  publishableKey,
  onPaymentMethodReady,
  submitting,
}: {
  clientSecret: string;
  publishableKey: string;
  onPaymentMethodReady: (paymentMethodId: string) => Promise<void>;
  submitting: boolean;
}) {
  const stripePromise = getStripe(publishableKey);
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#e85d04',
            borderRadius: '8px',
          },
        },
      }}
    >
      <SenderPaymentElementInner
        onPaymentMethodReady={onPaymentMethodReady}
        submitting={submitting}
      />
    </Elements>
  );
}
