import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { getOrderId } from '../api/orders'
import { buildBookingFromPgStatus } from '../constants/tickets'
import { TicketsPage } from '../features/tickets/TicketsPage'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { PG_STATUS_POLL_MS, usePgStatusPolling } from '../hooks/usePgStatusPolling'
import { withAppContext } from '../lib/appContext'
import { buildSuccessPath, useSuccessBackNavigation } from '../lib/successUrl'
import { orderAtom, tripAtom } from '../store/journey'
import './SuccessPage.css'

/**
 * /success?order=ORD-20260901-500526&src=android&versionName=4.7
 * Loads ticket + QR data from pg/status using order id only.
 */
export function SuccessPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const storedOrder = useAtomValue(orderAtom)
  const goBack = useSuccessBackNavigation(trip)

  const urlOrderId = params.get('order') || params.get('order_id')
  const orderId = urlOrderId || getOrderId(storedOrder)

  const [pgStatus, setPgStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  useEffect(() => {
    if (urlOrderId || !orderId) return
    navigate(
      buildSuccessPath({
        orderId,
        returnTo: params.get('returnTo'),
        fromCheckout: params.get('from') === 'checkout',
      }),
      { replace: true },
    )
  }, [navigate, orderId, params, urlOrderId])

  const onPgUpdate = useCallback((status) => {
    setPgStatus(status)
    setLoading(false)
    setFetchError('')
  }, [])

  const onPgError = useCallback((error) => {
    setLoading(false)
    setFetchError(error?.message || 'Could not load booking for this order.')
  }, [])

  const onBookingFailed = useCallback(() => {
    navigate('/payment/booking-failed', { replace: true })
  }, [navigate])

  usePgStatusPolling(orderId, {
    enabled: Boolean(orderId),
    intervalMs: PG_STATUS_POLL_MS,
    onUpdate: onPgUpdate,
    onBookingFailed,
    onError: onPgError,
  })

  const displayBooking = useMemo(() => {
    if (!pgStatus || !orderId) return null
    const order = { orderId, order_id: orderId, pgStatus }
    return buildBookingFromPgStatus({
      trip,
      order,
      pgStatus,
    })
  }, [orderId, pgStatus, trip])

  if (!orderId) {
    return <Navigate to={withAppContext('/journey')} replace />
  }

  if (loading && !displayBooking) {
    return (
      <div className="mt-success-loading" role="status">
        <p>Loading your tickets…</p>
      </div>
    )
  }

  if (fetchError && !displayBooking) {
    return (
      <div className="mt-success-loading mt-success-loading--error" role="alert">
        <p>{fetchError}</p>
      </div>
    )
  }

  return (
    <TicketsPage
      booking={displayBooking}
      onBack={goBack}
      onCall={() => window.alert('Calling support…')}
      onDropService={() => navigate('/gotohome', { replace: false })}
      onCancelled={goBack}
    />
  )
}
