import { withAppContext } from './appContext'

/** App route Paytm should redirect to instead of the raw MMTS JSON endpoint. */
export function buildPaymentCallbackPath(orderId, { journeyId } = {}) {
  const params = new URLSearchParams()
  if (orderId) params.set('order_id', String(orderId))
  if (journeyId != null) params.set('id', String(journeyId))
  return withAppContext(`/payment/callback?${params.toString()}`)
}

export function buildPaymentCallbackUrl(orderId, options = {}) {
  if (typeof window === 'undefined') return buildPaymentCallbackPath(orderId, options)
  return `${window.location.origin}${buildPaymentCallbackPath(orderId, options)}`
}
