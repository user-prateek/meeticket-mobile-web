import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { buildBooking } from '../constants/tickets'
import { TicketsPage } from '../features/tickets/TicketsPage'
import { useJourneyOptionById } from '../hooks/useJourneyOptions'
import { tripToSearch } from '../lib/tripQuery'
import { bookingAtom, tripAtom } from '../store/journey'

/**
 * /success?id=1
 * Booking confirmation / QR after cab book.
 */
export function SuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const trip = useAtomValue(tripAtom)
  const storedBooking = useAtomValue(bookingAtom)
  const id = params.get('id')
  const journey = useJourneyOptionById(id)

  if (!journey) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={fallback} replace />
  }

  const booking = storedBooking ?? buildBooking({ journey, trip })

  return (
    <TicketsPage
      key={booking.id}
      booking={booking}
      onBack={() => navigate(`/cab?id=${journey.id}&service=pickup`)}
      onCall={() => window.alert('Calling support…')}
      onCancelled={() => navigate(trip ? `/journey${tripToSearch(trip)}` : '/journey')}
    />
  )
}
