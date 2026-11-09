/** Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js), loaded only on the checkout page. */
export const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error?: { description?: string; metadata?: { payment_id?: string } };
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; contact: string; email: string };
  theme: { color: string };
  handler: (payment: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', handler: (failure: RazorpayFailure) => void) => void;
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let loading: Promise<RazorpayConstructor | null> | null = null;

/**
 * The script is preloaded by next/script on the checkout page; this waits for it (or injects it again
 * when it failed), so paying never depends on load order.
 */
export function loadRazorpay(): Promise<RazorpayConstructor | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(window.Razorpay ?? null);
    script.onerror = () => {
      loading = null;
      resolve(null);
    };
    document.body.appendChild(script);
  });
  return loading;
}
