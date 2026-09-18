import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useMemo } from 'react'
import {
  buildDropOrderPayload,
  buildOrderPayload,
  createOrderAndInitiatePg,
  getOrderId,
} from '../api/orders'
import {
  LAST_MILE_PROVIDER_DEFAULT,
  coerceEnabledProviderId,
} from '../constants/lastMile'
import { LastMilePage } from '../features/lastMile/LastMilePage'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useHydrateJourneyOptions, useJourneyOptionById, useSelectJourney } from '../hooks/useJourneyOptions'
import { withAppContext } from '../lib/appContext'
import {
  buildDirectCabJourney,
  cabDirectPath,
  cabDirectPaymentPath,
  isCabDirectRequest,
  rideHomePath,
} from '../lib/cabDirect'
import { preloadGoogleMaps } from '../lib/googleMaps'
import { buildSuccessPath } from '../lib/successUrl'
import { hasRequiredTripParams, parseTripQuery } from '../lib/tripQuery'
import { lastMileSelectionAtom, orderAtom, tripAtom, userAtom } from '../store/journey'

/**
 * /cab?id=1&service=pickup|drop&provider=&mode=&vehicle=&order=
 * First / last mile using access / egress from the selected journey.
 *
 * Cab-only entry: /cab?direct=1&provider=ola&from_lat=… (no journey option).
 * Drop Service: new CAB-only order (egress → B); `order` query is parent success back-nav only.
 */
export function CabPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useAppNavigate()
  const storedTrip = useAtomValue(tripAtom)
  const setTrip = useSetAtom(tripAtom)
  const user = useAtomValue(userAtom)
  const setOrder = useSetAtom(orderAtom)
  const setLastMileSelection = useSetAtom(lastMileSelectionAtom)
  const selectJourney = useSelectJourney()
  const id = params.get('id')
  const existingOrderId = params.get('order') || params.get('order_id') || ''
  const serviceId = params.get('service') === 'drop' ? 'drop' : 'pickup'
  const isDirect = isCabDirectRequest(params)
  const searchKey = params.toString()

  const urlHasTrip = hasRequiredTripParams(searchKey)
  const trip = useMemo(
    () => (urlHasTrip ? parseTripQuery(searchKey) : storedTrip),
    [urlHasTrip, searchKey, storedTrip],
  )

  useEffect(() => {
    if (!urlHasTrip) return
    setTrip(parseTripQuery(searchKey))
  }, [urlHasTrip, searchKey, setTrip])

  const requestedProvider = params.get('provider')
  const providerId = isDirect
    ? requestedProvider || LAST_MILE_PROVIDER_DEFAULT
    : coerceEnabledProviderId(requestedProvider, {
        fallback: LAST_MILE_PROVIDER_DEFAULT,
      }) || LAST_MILE_PROVIDER_DEFAULT
  const modeId = params.get('mode') || undefined
  const vehicleId = params.get('vehicle') || undefined

  const { hydrating } = useHydrateJourneyOptions(isDirect ? null : trip)
  const listedJourney = useJourneyOptionById(id)
  const directJourney = useMemo(
    () => (isDirect ? buildDirectCabJourney(trip) : null),
    [isDirect, trip],
  )
  const journey = isDirect ? directJourney : listedJourney

  useEffect(() => {
    preloadGoogleMaps()
  }, [])

  useEffect(() => {
    if (!isDirect || !directJourney) return
    selectJourney(directJourney)
  }, [isDirect, directJourney, selectJourney])

  if (isDirect && !directJourney) {
    return <Navigate to={withAppContext(rideHomePath(storedTrip))} replace />
  }

  if (!journey) {
    if (hydrating) {
      return (
        <div className="mt-success-loading" role="status">
          <p>Loading cab options…</p>
        </div>
      )
    }
    return <Navigate to={withAppContext(isDirect ? rideHomePath(trip) : '/journey')} replace />
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
    if (isDirect) return cabDirectPaymentPath()
    return `/payment?id=${String(journey.id)}`
  }

  function backPath() {
    if (existingOrderId && serviceId === 'drop') {
      return buildSuccessPath({ orderId: existingOrderId })
    }
    if (isDirect) {
      return rideHomePath(trip)
    }
    return detailPath()
  }

  function handleSelectionChange({
    providerId: nextProvider,
    modeId: nextMode,
    vehicleId: nextVehicle,
  }) {
    if (isDirect) {
      const next = new URLSearchParams(
        cabDirectPath({
          trip,
          providerId: nextProvider,
          modeId: nextMode,
          vehicleId: nextVehicle,
        }).split('?')[1] || '',
      )
      setParams(next, { replace: true })
      return
    }
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
      cabDirect: Boolean(isDirect || journey.cabDirect),
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
    if (order.payAtPickupOnly) {
      const orderId = getOrderId(order)
      navigate(buildSuccessPath({ orderId }), { replace: true })
      return
    }
    navigate(paymentPath(), { replace: true })
  }

  return (
    <LastMilePage
      journey={journey}
      serviceId={serviceId}
      mile={mile}
      trip={trip}
      lockProvider={isDirect}
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
