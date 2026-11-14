import type { Appearance } from '@stripe/stripe-js';

/**
 * High-contrast light Stripe Elements theme.
 * Payment dialogs always use a light chrome so Payment Element labels stay readable
 * even when the rest of the app is in dark mode.
 */
export const STRIPE_PAYMENT_APPEARANCE: Appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#e85d04',
    colorBackground: '#ffffff',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorDanger: '#dc2626',
    colorTextPlaceholder: '#94a3b8',
    borderRadius: '8px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  rules: {
    '.Input': {
      backgroundColor: '#ffffff',
      color: '#0f172a',
      border: '1px solid #cbd5e1',
    },
    '.Input:focus': {
      border: '1px solid #e85d04',
      boxShadow: '0 0 0 1px #e85d04',
    },
    '.Label': {
      color: '#0f172a',
      fontWeight: '600',
    },
    '.Tab': {
      color: '#475569',
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
    },
    '.Tab--selected': {
      color: '#0f172a',
      backgroundColor: '#ffffff',
      border: '1px solid #e85d04',
    },
    '.Error': {
      color: '#dc2626',
    },
  },
};
