import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { buildBooking } from '../constants/tickets'
import { LastMilePage } from '../features/lastMile/LastMilePage'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById, useSelectJourney } from '../hooks/useJourneyOptions'
import { withAppContext } from '../lib/appContext'
import { preloadGoogleMaps } from '../lib/googleMaps'
import { tripToSearch } from '../lib/tripQuery'
import { bookingAtom, tripAtom } from '../store/journey'

/**
 * /cab?id=1&service=pickup|drop
 * First / last mile booking using access / egress from the selected journey.
 */
export function CabPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const setBooking = useSetAtom(bookingAtom)
  const selectJourney = useSelectJourney()
  const id = params.get('id')
  const serviceId = params.get('service') === 'drop' ? 'drop' : 'pickup'
  const journey = useJourneyOptionById(id)

  useEffect(() => {
    preloadGoogleMaps()
  }, [])

  if (!journey) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={withAppContext(fallback)} replace />
  }

  const mile = serviceId === 'drop' ? journey.egress : journey.access

  function handleBook({ vehicle, providerId, modeId }) {
    selectJourney(journey)
    const booking = buildBooking({ journey, vehicle, serviceId, trip })
    setBooking({ ...booking, providerId, modeId })
    navigate(`/success?id=${journey.id}`)
  }

  return (
    <LastMilePage
      journey={journey}
      serviceId={serviceId}
      mile={mile}
      trip={trip}
      fromPlace={mile?.fromLabel || trip?.fromPlace || 'Pickup'}
      toPlace={mile?.toLabel || trip?.toPlace || 'Drop'}
      onBack={() => navigate(`/journey-detail?id=${journey.id}`)}
      onBook={handleBook}
    />
  )
}
