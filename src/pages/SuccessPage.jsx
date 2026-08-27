import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { buildBooking } from '../constants/tickets'
import { TicketsPage } from '../features/tickets/TicketsPage'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById } from '../hooks/useJourneyOptions'
import { withAppContext } from '../lib/appContext'
import { tripToSearch } from '../lib/tripQuery'
import { bookingAtom, lastMileSelectionAtom, tripAtom } from '../store/journey'

/**
 * /success?id=1
 * Booking confirmation / QR after cab book.
 */
export function SuccessPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const storedBooking = useAtomValue(bookingAtom)
  const lastMile = useAtomValue(lastMileSelectionAtom)
  const id = params.get('id')
  const journey = useJourneyOptionById(id)

  if (!journey) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={withAppContext(fallback)} replace />
  }

  const booking = storedBooking ?? buildBooking({ journey, trip })

  function detailPath() {
    const next = new URLSearchParams({ id: String(journey.id) })
    const providerId = storedBooking?.providerId || lastMile?.providerId
    const modeId = storedBooking?.modeId || lastMile?.modeId
    const vehicleId = storedBooking?.vehicleId || lastMile?.vehicleId
    if (providerId) next.set('provider', providerId)
    if (modeId) next.set('mode', modeId)
    if (vehicleId) next.set('vehicle', vehicleId)
    return `/journey-detail?${next.toString()}`
  }

  return (
    <TicketsPage
      key={booking.id}
      booking={booking}
      onBack={() => navigate(detailPath(), { replace: true })}
      onCall={() => window.alert('Calling support…')}
      onCancelled={() => navigate(trip ? `/journey${tripToSearch(trip)}` : '/journey', { replace: true })}
    />
  )
}
