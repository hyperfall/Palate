import Stripe from 'stripe'

/**
 * Lazy Stripe client + config, null until envs are set — the same graceful-
 * degradation contract as the Supabase clients. Nothing supporter-related may
 * crash a site that hasn't configured payments yet.
 */

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

export function supporterPriceId(): string | null {
  return process.env.STRIPE_PRICE_SUPPORTER ?? null
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_SUPPORTER)
}

export const SUPPORTER_PRICE_LABEL =
  process.env.NEXT_PUBLIC_SUPPORTER_PRICE_LABEL ?? '£3.50/month'
