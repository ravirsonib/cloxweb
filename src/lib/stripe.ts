import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;
let lastKey: string | null = null;

/** Shared Stripe.js loader — one instance per publishable key. */
export function getStripe(publishableKey: string | null | undefined) {
  if (!publishableKey) return Promise.resolve(null);
  if (!stripePromise || lastKey !== publishableKey) {
    lastKey = publishableKey;
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
}
