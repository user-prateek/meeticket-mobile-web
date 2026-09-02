import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { getOrderId } from '../api/orders'
import { LastMilePage } from '../features/lastMile/LastMilePage'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById, useSelectJourney } from '../hooks/useJourneyOptions'
import { buildSuccessPath } from '../lib/successUrl'
import { withAppContext } from '../lib/appContext'
import { preloadGoogleMaps } from '../lib/googleMaps'
import { tripToSearch } from '../lib/tripQuery'
import { lastMileSelectionAtom, orderAtom, tripAtom } from '../store/journey'

/**
 * /cab?id=1&service=pickup|drop&provider=&mode=&vehicle=
 * First / last mile booking using access / egress from the selected journey.
 * Provider is locked from query params — no provider switcher on this page.
 */
export function CabPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const storedOrder = useAtomValue(orderAtom)
  const setLastMileSelection = useSetAtom(lastMileSelectionAtom)
  const selectJourney = useSelectJourney()
  const id = params.get('id')
  const serviceId = params.get('service') === 'drop' ? 'drop' : 'pickup'
  const providerId = params.get('provider') || undefined
  const modeId = params.get('mode') || undefined
  const vehicleId = params.get('vehicle') || undefined
  const journey = useJourneyOptionById(id)

  useEffect(() => {
    preloadGoogleMaps()
  }, [])

  if (!journey) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={withAppContext(fallback)} replace />
  }

  const mile = serviceId === 'drop' ? journey.egress : journey.access

  function detailPath() {
    const next = new URLSearchParams({ id: String(journey.id) })
    if (providerId) next.set('provider', providerId)
    if (modeId) next.set('mode', modeId)
    if (vehicleId) next.set('vehicle', vehicleId)
    return `/journey-detail?${next.toString()}`
  }

  function handleSelectionChange({ providerId: nextProvider, modeId: nextMode, vehicleId: nextVehicle }) {
    const next = new URLSearchParams({
      id: String(journey.id),
      service: serviceId,
    })
    if (nextProvider) next.set('provider', nextProvider)
    if (nextMode) next.set('mode', nextMode)
    if (nextVehicle) next.set('vehicle', nextVehicle)
    setParams(next, { replace: true })
  }

  function handleBook({ vehicle, providerId: bookedProvider, modeId: bookedMode }) {
    selectJourney(journey)
    setLastMileSelection({
      journeyId: journey.id,
      providerId: bookedProvider || null,
      modeId: bookedMode || null,
      vehicleId: vehicle?.id || null,
      refexSearchId: vehicle?.searchId || null,
    })
    navigate(
      buildSuccessPath({
        orderId: getOrderId(storedOrder),
        returnTo: detailPath(),
      }),
      { replace: true },
    )
  }

  return (
    <LastMilePage
      journey={journey}
      serviceId={serviceId}
      mile={mile}
      trip={trip}
      initialProviderId={providerId}
      initialModeId={modeId}
      initialVehicleId={vehicleId}
      fromPlace={mile?.fromLabel || trip?.fromPlace || 'Pickup'}
      toPlace={mile?.toLabel || trip?.toPlace || 'Drop'}
      onBack={() => navigate(detailPath())}
      onSelectionChange={handleSelectionChange}
      onBook={handleBook}
    />
  )
}
