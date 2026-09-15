import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import {
  buildDropOrderPayload,
  buildOrderPayload,
  createOrderAndInitiatePg,
} from '../api/orders'
import {
  LAST_MILE_PROVIDER_DEFAULT,
  coerceEnabledProviderId,
} from '../constants/lastMile'
import { LastMilePage } from '../features/lastMile/LastMilePage'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useHydrateJourneyOptions, useJourneyOptionById, useSelectJourney } from '../hooks/useJourneyOptions'
import { withAppContext } from '../lib/appContext'
import { preloadGoogleMaps } from '../lib/googleMaps'
import { buildSuccessPath } from '../lib/successUrl'
import { lastMileSelectionAtom, orderAtom, tripAtom, userAtom } from '../store/journey'

/**
 * /cab?id=1&service=pickup|drop&provider=&mode=&vehicle=&order=
 * First / last mile booking using access / egress from the selected journey.
 * Drop Service: new CAB-only order (egress → B); `order` query is parent success back-nav only.
 */
export function CabPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const user = useAtomValue(userAtom)
  const setOrder = useSetAtom(orderAtom)
  const setLastMileSelection = useSetAtom(lastMileSelectionAtom)
  const selectJourney = useSelectJourney()
  const id = params.get('id')
  const existingOrderId = params.get('order') || params.get('order_id') || ''
  const serviceId = params.get('service') === 'drop' ? 'drop' : 'pickup'
  const providerId =
    coerceEnabledProviderId(params.get('provider'), {
      fallback: LAST_MILE_PROVIDER_DEFAULT,
    }) || LAST_MILE_PROVIDER_DEFAULT
  const modeId = params.get('mode') || undefined
  const vehicleId = params.get('vehicle') || undefined

  const { hydrating } = useHydrateJourneyOptions(trip)
  const journey = useJourneyOptionById(id)

  useEffect(() => {
    preloadGoogleMaps()
  }, [])

  if (!journey) {
    if (hydrating) {
      return (
        <div className="mt-success-loading" role="status">
          <p>Loading cab options…</p>
        </div>
      )
    }
    return <Navigate to={withAppContext('/journey')} replace />
  }

  const mile = serviceId === 'drop' ? journey.egress : journey.access
  const fromPlace =
    mile?.fromLabel ||
    (serviceId === 'drop' ? journey.destinationStation : trip?.fromPlace) ||
    (serviceId === 'drop' ? 'Station' : 'Pickup')
  const toPlace =
    mile?.toLabel ||
    (serviceId === 'drop' ? trip?.toPlace : journey.originStation) ||
    (serviceId === 'drop' ? 'Drop' : 'Station')

  function detailPath() {
    const next = new URLSearchParams({ id: String(journey.id) })
    if (providerId) next.set('provider', providerId)
    if (modeId) next.set('mode', modeId)
    if (vehicleId) next.set('vehicle', vehicleId)
    return `/journey-detail?${next.toString()}`
  }

  function paymentPath() {
    return `/payment?id=${String(journey.id)}`
  }

  function backPath() {
    if (existingOrderId && serviceId === 'drop') {
      return buildSuccessPath({ orderId: existingOrderId })
    }
    return detailPath()
  }

  function handleSelectionChange({ providerId: nextProvider, modeId: nextMode, vehicleId: nextVehicle }) {
    const next = new URLSearchParams({
      id: String(journey.id),
      service: serviceId,
    })
    if (existingOrderId) next.set('order', existingOrderId)
    if (nextProvider) next.set('provider', nextProvider)
    if (nextMode) next.set('mode', nextMode)
    if (nextVehicle) next.set('vehicle', nextVehicle)
    setParams(next, { replace: true })
  }

  async function handleBook({ vehicle, providerId: bookedProvider, modeId: bookedMode }) {
    const lastMile = {
      journeyId: journey.id,
      providerId: bookedProvider || null,
      modeId: bookedMode || null,
      vehicleId: vehicle?.id || null,
      fareInr: vehicle?.fareInr ?? null,
      fareMaxInr: vehicle?.fareMaxInr ?? null,
      fareDisplay: vehicle?.fareDisplay || null,
      fareId: vehicle?.fareId || null,
      categoryId: vehicle?.categoryId || null,
      pickupMode: vehicle?.pickupMode || (bookedProvider === 'ola' ? 'now' : null),
      couponCode: vehicle?.discountCode || null,
      refexSearchId: vehicle?.searchId || null,
      serviceId,
      // Parent transit order — UI back-nav only; payment uses the new order id.
      parentOrderId: existingOrderId || null,
    }

    selectJourney(journey)
    setLastMileSelection(lastMile)

    const payload =
      serviceId === 'drop'
        ? await buildDropOrderPayload({
            journey,
            trip,
            lastMile,
            selectedVehicle: vehicle,
            user,
          })
        : await buildOrderPayload({
            journey,
            trip,
            lastMile,
            selectedVehicle: vehicle,
            user,
          })
    const order = await createOrderAndInitiatePg(payload, { journeyId: journey.id })
    setOrder(order)
    navigate(paymentPath(), { replace: true })
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
      fromPlace={fromPlace}
      toPlace={toPlace}
      onBack={() => navigate(backPath())}
      onSelectionChange={handleSelectionChange}
      onBook={handleBook}
    />
  )
}
