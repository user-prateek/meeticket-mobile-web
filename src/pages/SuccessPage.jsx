import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { cancelOrderLeg, fetchOrderPgStatus, getOrderId } from '../api/orders'
import { buildBookingFromPgStatus } from '../constants/tickets'
import { DropServiceSheet } from '../features/tickets/DropServiceSheet'
import { TicketsPage } from '../features/tickets/TicketsPage'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useHydrateJourneyOptions, useSelectJourney } from '../hooks/useJourneyOptions'
import { PG_STATUS_POLL_MS, usePgStatusPolling } from '../hooks/usePgStatusPolling'
import { withAppContext } from '../lib/appContext'
import { isCabDirectJourney } from '../lib/cabDirect'
import { OLA_SEARCHING_PREVIEW, buildOlaSearchingPreviewBooking } from '../lib/successPreview'
import { buildSuccessPath, useSuccessBackNavigation } from '../lib/successUrl'
import {
  journeyOptionsAtom,
  lastMileSelectionAtom,
  orderAtom,
  selectedJourneyAtom,
  selectedJourneyIdAtom,
  tripAtom,
} from '../store/journey'
import './SuccessPage.css'

/**
 * /success?order=ORD-…
 * Loads ticket + QR + Map Guide from pg/status using order id only.
 * Drop Service opens operator sheet → /cab?service=drop (new last-mile order).
 */
export function SuccessPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const storedOrder = useAtomValue(orderAtom)
  const journey = useAtomValue(selectedJourneyAtom)
  const lastMile = useAtomValue(lastMileSelectionAtom)
  const selectedJourneyId = useAtomValue(selectedJourneyIdAtom)
  const journeyOptions = useAtomValue(journeyOptionsAtom)
  const selectJourney = useSelectJourney()
  const goBack = useSuccessBackNavigation(trip)

  const cabDirect = Boolean(lastMile?.cabDirect || isCabDirectJourney(journey))

  // Rehydrate journey options after refresh so Drop Service → /cab has egress.
  useHydrateJourneyOptions(cabDirect ? null : trip)

  useEffect(() => {
    if (cabDirect || !journeyOptions.length) return
    if (journeyOptions.some((option) => Number(option.id) === Number(selectedJourneyId))) return
    selectJourney(journeyOptions[0])
  }, [cabDirect, journeyOptions, selectedJourneyId, selectJourney])

  const urlOrderId = params.get('order') || params.get('order_id')
  const isOlaSearchingPreview = params.get('preview') === OLA_SEARCHING_PREVIEW
  const orderId = urlOrderId || getOrderId(storedOrder)

  const [pgStatus, setPgStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [dropOpen, setDropOpen] = useState(false)
  const [dropFromLabel, setDropFromLabel] = useState('')

  useEffect(() => {
    if (isOlaSearchingPreview) return
    if (urlOrderId || !orderId) return
    navigate(buildSuccessPath({ orderId }), { replace: true })
  }, [isOlaSearchingPreview, navigate, orderId, urlOrderId])

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
    enabled: Boolean(orderId) && !isOlaSearchingPreview,
    intervalMs: PG_STATUS_POLL_MS,
    onUpdate: onPgUpdate,
    onBookingFailed,
    onError: onPgError,
  })

  const displayBooking = useMemo(() => {
    if (isOlaSearchingPreview) {
      return buildOlaSearchingPreviewBooking({ journey, trip, lastMile })
    }
    if (!pgStatus || !orderId) return null
    const order = { orderId, order_id: orderId, pgStatus }
    return buildBookingFromPgStatus({
      journey,
      trip,
      order,
      pgStatus,
      lastMile,
    })
  }, [isOlaSearchingPreview, journey, lastMile, orderId, pgStatus, trip])

  const journeyId = journey?.id ?? selectedJourneyId ?? displayBooking?.journeyId ?? storedOrder?.journeyId

  async function handleCancelled({ legId, reason, reasonLabel, reasonNote }) {
    if (isOlaSearchingPreview) return
    if (!orderId) {
      throw new Error('Missing order id')
    }
    if (legId == null || legId === '') {
      throw new Error('Missing cab leg id')
    }

    const cancelReason =
      reasonNote || reason || reasonLabel || 'Customer cancelled'

    await cancelOrderLeg(orderId, legId, {
      cancelled_by: 'Customer',
      reason: cancelReason,
    })

    const status = await fetchOrderPgStatus(orderId)
    setPgStatus(status)
    setFetchError('')
  }

  function handleDropService(ticket) {
    setDropFromLabel(
      ticket?.to ||
        journey?.egress?.fromLabel ||
        journey?.destinationStation ||
        pgStatus?.bookings?.find((b) => String(b.leg_type).toUpperCase() !== 'CAB')?.ToLocName ||
        '',
    )
    setDropOpen(true)
  }

  function handleDropConfirm({ providerId, modeId, vehicleId }) {
    if (!journeyId) return
    const next = new URLSearchParams({
      id: String(journeyId),
      service: 'drop',
    })
    // Parent transit order — used for back nav only; drop creates a new order id.
    if (orderId) next.set('order', String(orderId))
    if (providerId) next.set('provider', providerId)
    if (modeId) next.set('mode', modeId)
    if (vehicleId) next.set('vehicle', vehicleId)
    setDropOpen(false)
    navigate(`/cab?${next.toString()}`)
  }

  if (!orderId && !isOlaSearchingPreview) {
    return <Navigate to={withAppContext(cabDirect ? '/ride' : '/journey')} replace />
  }

  if (loading && !displayBooking && !isOlaSearchingPreview) {
    return (
      <div className="mt-success-loading" role="status">
        <p>Loading your tickets…</p>
      </div>
    )
  }

  if (fetchError && !displayBooking && !isOlaSearchingPreview) {
    return (
      <div className="mt-success-loading mt-success-loading--error" role="alert">
        <p>{fetchError}</p>
      </div>
    )
  }

  return (
    <>
      <TicketsPage
        booking={displayBooking}
        journey={journey}
        trip={trip}
        onBack={goBack}
        onCall={() => window.alert('Calling support…')}
        onDropService={handleDropService}
        onCancelled={handleCancelled}
      />
      <DropServiceSheet
        open={dropOpen}
        fromLabel={dropFromLabel}
        journey={journey}
        trip={trip}
        pgStatus={pgStatus}
        onClose={() => setDropOpen(false)}
        onConfirm={handleDropConfirm}
      />
    </>
  )
}
