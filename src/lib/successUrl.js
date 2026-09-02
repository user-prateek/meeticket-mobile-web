import { useCallback, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { withAppContext } from './appContext'
import { tripToSearch } from './tripQuery'

/** Internal app path only — blocks open redirects. */
export function sanitizeReturnTo(value) {
  if (!value || typeof value !== 'string') return null
  const path = value.trim()
  if (!path.startsWith('/') || path.startsWith('//')) return null
  return path
}

/** Build /success?order=ORD-… (+ optional returnTo / from=checkout). */
export function buildSuccessPath({ orderId, returnTo, fromCheckout } = {}) {
  const params = new URLSearchParams()
  if (orderId) params.set('order', String(orderId))
  const safeReturn = sanitizeReturnTo(returnTo)
  if (safeReturn) params.set('returnTo', safeReturn)
  if (fromCheckout) params.set('from', 'checkout')
  const query = params.toString()
  return withAppContext(query ? `/success?${query}` : '/success')
}

export function journeyReturnPath(trip) {
  return trip ? `/journey${tripToSearch(trip)}` : '/journey'
}

/** Where Success should send the user on back (title bar or browser). */
export function resolveSuccessReturnTo(searchParams, trip) {
  const explicit = sanitizeReturnTo(searchParams.get('returnTo'))
  if (explicit) return withAppContext(explicit)

  if (searchParams.get('from') === 'checkout') {
    return withAppContext(journeyReturnPath(trip))
  }

  return null
}

/**
 * Success page back: honor returnTo / checkout → journey; else history.back(); else journey.
 * Also intercepts browser back when a fixed return path is known.
 */
export function useSuccessBackNavigation(trip) {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()

  const returnPath = useMemo(() => resolveSuccessReturnTo(params, trip), [params, trip])
  const fromCheckout = params.get('from') === 'checkout'

  const goBack = useCallback(() => {
    if (fromCheckout && returnPath) {
      navigate(returnPath, { replace: true })
      return
    }
    if (returnPath) {
      if (window.history.length > 1) {
        navigate(-1)
        return
      }
      navigate(returnPath, { replace: true })
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(withAppContext(journeyReturnPath(trip)), { replace: true })
  }, [fromCheckout, navigate, returnPath, trip])

  useEffect(() => {
    if (!fromCheckout || !returnPath) return undefined

    const onPopState = () => {
      navigate(returnPath, { replace: true })
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [fromCheckout, navigate, returnPath])

  return goBack
}
