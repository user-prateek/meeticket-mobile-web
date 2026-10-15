import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { createOrderAndInitiatePg } from '../../api/orders'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { orderAtom } from '../../store/journey'
import { fetchStopFare } from './api'
import { BookBar, BusTicketHeader } from './BusTicketChrome'
import { BusRouteMap } from './BusRouteMap'
import {
  categoryLabel,
  minutesUntilClock,
  routeCode,
  stopTitle,
  ticketCountLabel,
} from './format'
import { BusArt, ChevronIcon, PinIcon } from './icons'
import { buildBusTicketOrderPayload } from './orderPayload'
import { loadBusTicketDraft, patchBusTicketDraft } from './session'
import './BusTicket.css'

function busPath(draft) {
  const params = new URLSearchParams()
  if (draft?.vehicleId) params.set('vehicle_id', draft.vehicleId)
  if (draft?.lat != null) params.set('lat', String(draft.lat))
  if (draft?.lng != null) params.set('lng', String(draft.lng))
  const query = params.toString()
  return query ? `/bus?${query}` : '/bus'
}

export function BusTicketSummaryPage() {
  const navigate = useAppNavigate()
  const setOrder = useSetAtom(orderAtom)
  const draft = useMemo(() => loadBusTicketDraft(), [])
  const [fareInr, setFareInr] = useState(draft?.fareInr ?? null)
  const [fareCategory, setFareCategory] = useState(draft?.fareCategory || '')
  const [fareError, setFareError] = useState('')
  const [fareLoading, setFareLoading] = useState(false)
  const [seats, setSeats] = useState(draft?.seats || 1)
  const [sheet, setSheet] = useState(null)
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')

  const source = draft?.source
  const destination = draft?.destination
  const rideStops = useMemo(() => {
    const stops = draft?.stops || []
    if (!source || !destination) return []
    return stops.filter(
      (stop) =>
        Number(stop.stop_sequence) >= Number(source.stop_sequence) &&
        Number(stop.stop_sequence) <= Number(destination.stop_sequence),
    )
  }, [destination, draft?.stops, source])

  useEffect(() => {
    if (!draft?.chaloRouteId || !source || !destination) return undefined
    const controller = new AbortController()
    setFareLoading(true)
    setFareError('')
    fetchStopFare(
      {
        fromStopId: source.stop_id,
        toStopId: destination.stop_id,
        chaloRouteId: draft.chaloRouteId,
      },
      { signal: controller.signal },
    )
      .then((fare) => {
        setFareInr(fare.fare)
        setFareCategory(fare.serviceCategory)
        patchBusTicketDraft({
          fareInr: fare.fare,
          fareCategory: fare.serviceCategory,
          fareFromStopId: fare.fromStopId,
          fareToStopId: fare.toStopId,
          fareRouteId: fare.chaloRouteId,
        })
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        setFareError(error?.message || 'Could not load fare')
      })
      .finally(() => {
        if (!controller.signal.aborted) setFareLoading(false)
      })
    return () => controller.abort()
  }, [destination, draft?.chaloRouteId, source])

  if (!draft?.source || !draft?.destination) {
    return <Navigate to="/bus" replace />
  }

  const eta = minutesUntilClock(destination.arrival_time || destination.departure_time)
  const etaLabel =
    eta != null && eta > 0
      ? `${eta} min`
      : String(destination.arrival_time || destination.departure_time || '').slice(0, 5)
  const total = fareInr ? fareInr * seats : null
  const code = routeCode(draft.routeName)
  const category = categoryLabel(fareCategory || draft.serviceCategory)

  async function book() {
    if (booking || !total) return
    setBooking(true)
    setBookError('')
    try {
      const next = patchBusTicketDraft({ seats, fareInr })
      const payload = buildBusTicketOrderPayload(next)
      const order = await createOrderAndInitiatePg(payload)
      patchBusTicketDraft({ orderId: order.orderId, seats, fareInr })
      setOrder(order)
      navigate('/payment?flow=bus', { replace: true })
    } catch (error) {
      setBookError(error?.message || 'Could not start payment')
      setBooking(false)
    }
  }

  return (
    <section className="bt-page">
      <BusTicketHeader variant="menu" onBack={() => navigate('/bus')} />
      <div className="bt-scroll">
        <BusRouteMap stops={rideStops} />
        <article className="bt-card bt-summary-card">
          <div className="bt-place bt-place--plain">
            <PinIcon />
            <div>
              <p className="bt-place__label">Source Stop</p>
              <p className="bt-place__name">{stopTitle(source)}</p>
            </div>
          </div>
          <div className="bt-place bt-place--fare">
            <PinIcon />
            <div>
              <p className="bt-place__label">Destination Stop</p>
              <p className="bt-place__name">{stopTitle(destination)}</p>
            </div>
            {fareInr ? <span className="bt-fare">₹{fareInr}</span> : null}
          </div>
        </article>

        <article className="bt-card bt-ride">
          <div className="bt-ride__copy">
            <p className="bt-you__label">You are in</p>
            <p className="bt-you__name">
              <strong>{code}</strong> {category}
            </p>
            <div className="bt-ride__row">
              <button type="button" className="bt-change" onClick={() => navigate(busPath(draft))}>
                Change Bus <ChevronIcon />
              </button>
              <p>
                Tickets works for
                <br />
                buses in the
                <br />
                {category} tier
              </p>
            </div>
          </div>
          <BusArt side />
        </article>

        <section className="bt-arrives">
          <h3>Arrives at {stopTitle(destination)}</h3>
          <div className="bt-chips">
            {etaLabel ? <span className="bt-chip">{etaLabel}</span> : null}
            <button type="button" className="bt-timetable" onClick={() => setSheet('times')}>
              Time Table
            </button>
          </div>
        </section>

        <button type="button" className="bt-pay-row" onClick={() => setSheet('seats')}>
          <span>
            Ticket Payment
            <br />
            Information
          </span>
          <span className="bt-pay-row__count">
            {ticketCountLabel(seats)} <ChevronIcon />
          </span>
        </button>
        {fareLoading ? <p className="bt-status">Loading fare…</p> : null}
        {fareError || bookError ? <p className="bt-status bt-status--error">{fareError || bookError}</p> : null}
      </div>
      <BookBar
        label={total ? `BOOK BUS TICKET @ RS ${total}` : 'BOOK BUS TICKET'}
        disabled={!total || booking}
        onClick={book}
      />

      {sheet ? (
        <div className="bt-sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="bt-sheet" onClick={(event) => event.stopPropagation()} role="dialog">
            {sheet === 'seats' ? (
              <>
                <h3>Number of tickets</h3>
                <div className="bt-stepper">
                  <button type="button" onClick={() => setSeats((n) => Math.max(1, n - 1))} aria-label="Fewer tickets">
                    −
                  </button>
                  <strong>{String(seats).padStart(2, '0')}</strong>
                  <button type="button" onClick={() => setSeats((n) => Math.min(6, n + 1))} aria-label="More tickets">
                    +
                  </button>
                </div>
                <BookBar label="Done" onClick={() => setSheet(null)} />
              </>
            ) : (
              <>
                <h3>Time Table</h3>
                <ul className="bt-times">
                  {rideStops.map((stop) => (
                    <li key={`${stop.stop_sequence}-${stop.stop_id}`}>
                      {stopTitle(stop)}
                      <span>{String(stop.departure_time || '').slice(0, 5)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
