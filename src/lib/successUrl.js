import { withAppContext } from './appContext'

/** Build /success?order=ORD-… (+ src & versionName from app context). */
export function buildSuccessPath({ orderId } = {}) {
  const params = new URLSearchParams()
  if (orderId) params.set('order', String(orderId))
  const query = params.toString()
  return withAppContext(query ? `/success?${query}` : '/success')
}
