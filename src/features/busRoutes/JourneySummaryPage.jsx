import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { createOrderAndInitiatePg } from '../../api/orders'
import { Header } from '../../components/Header'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { orderAtom } from '../../store/journey'
import { parseTripQuery } from '../../lib/tripQuery'
import { fetchRouteCheckout } from './api'
import { BusGlyph } from './BusGlyph'
import { buildLiveBusOrderPayload } from './orderPayload'
import { LiveBusMark } from './LiveBusMark'
import './JourneySummaryPage.css'

function readQuery(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const trip = parseTripQuery(params)
  return {
    routeId: params.get('route_id') || '',
    vehicleId: params.get('vehicle_id') || '',
    tripId: params.get('trip_id') || '',
    fromStopId: params.get('from_stop_id') || '',
    toStopId: params.get('to_stop_id') || '',
    dropStopId: params.get('to_stop_id') || '',
    code: params.get('code') || '',
    category: params.get('category') || '',
    fare: params.get('fare') || '',
    fromLat: trip.fromLat,
    fromLon: trip.fromLon,
    toLat: trip.toLat,
    toLon: trip.toLon,
    fromPlace: trip.fromPlace || '',
    toPlace: trip.toPlace || '',
    raw: params,
  }
}

/** Design: passenger avatar on #060496 disc. */
function PersonIcon() {
  return (
    <svg width="37" height="37" viewBox="0 0 37 37" fill="none" aria-hidden="true">
      <rect width="37" height="37" rx="18.5" fill="#060496" />
      <path
        d="M15.8219 16.9301C14.9406 16.0488 14.5 14.9895 14.5 13.752C14.5 12.5145 14.9406 11.4551 15.8219 10.5738C16.7031 9.69258 17.7625 9.25195 19 9.25195C20.2375 9.25195 21.2969 9.69258 22.1781 10.5738C23.0594 11.4551 23.5 12.5145 23.5 13.752C23.5 14.9895 23.0594 16.0488 22.1781 16.9301C21.2969 17.8113 20.2375 18.252 19 18.252C17.7625 18.252 16.7031 17.8113 15.8219 16.9301ZM10 27.252V24.102C10 23.4645 10.1641 22.8785 10.4922 22.3441C10.8203 21.8098 11.2562 21.402 11.8 21.1207C12.9625 20.5395 14.1437 20.1035 15.3438 19.8129C16.5437 19.5223 17.7625 19.377 19 19.377C20.2375 19.377 21.4562 19.5223 22.6562 19.8129C23.8562 20.1035 25.0375 20.5395 26.2 21.1207C26.7437 21.402 27.1797 21.8098 27.5078 22.3441C27.8359 22.8785 28 23.4645 28 24.102V27.252H10Z"
        fill="white"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M9.2 3.2 12.8 6.8 5.6 14H2v-3.6L9.2 3.2Z"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Design assets — 34×34 circle marks from Figma. */
function SourceMarkIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="17" fill="#E4F3FE" />
      <path
        d="M16 27.9508V25.9508C13.92 25.7174 12.1334 24.8541 10.64 23.3608C9.14672 21.8674 8.28338 20.0808 8.05005 18.0008H6.05005V16.0008H8.05005C8.28338 13.9208 9.14672 12.1341 10.64 10.6408C12.1334 9.14745 13.92 8.28411 16 8.05078V6.05078H18V8.05078C20.0867 8.28411 21.8734 9.14745 23.3601 10.6408C24.8467 12.1341 25.7101 13.9208 25.9501 16.0008H27.9501V18.0008H25.9501C25.7167 20.0874 24.8534 21.8741 23.3601 23.3608C21.8667 24.8475 20.08 25.7108 18 25.9508V27.9508H16ZM21.95 21.9508C23.3167 20.5841 24 18.9341 24 17.0008C24 15.0674 23.3167 13.4174 21.95 12.0508C20.5834 10.6841 18.9334 10.0008 17 10.0008C15.0667 10.0008 13.4167 10.6841 12.05 12.0508C10.6834 13.4174 10 15.0674 10 17.0008C10 18.9341 10.6834 20.5841 12.05 21.9508C13.4167 23.3174 15.0667 24.0008 17 24.0008C18.9334 24.0008 20.5834 23.3174 21.95 21.9508ZM14.18 19.8308C13.3934 19.0441 13 18.1008 13 17.0008C13 15.9008 13.3934 14.9574 14.18 14.1708C14.9667 13.3841 15.9067 12.9941 17 13.0008C18.0934 13.0074 19.0367 13.3974 19.83 14.1708C20.6234 14.9441 21.0134 15.8874 21 17.0008C20.9867 18.1141 20.5967 19.0541 19.83 19.8208C19.0634 20.5874 18.12 20.9808 17 21.0008C15.88 21.0208 14.94 20.6308 14.18 19.8308Z"
        fill="#407AFE"
      />
    </svg>
  )
}

/** Same pin shape; board = blue, dest = green. */
function PinMark({ bg = '#E4F3FE', fg = '#407AFE' }) {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <rect width="34" height="34" rx="17" fill={bg} />
      <path
        d="M18.3242 16.4713C18.6914 16.1188 18.875 15.695 18.875 15.2C18.875 14.705 18.6914 14.2813 18.3242 13.9288C17.957 13.5763 17.5156 13.4 17 13.4C16.4844 13.4 16.043 13.5763 15.6758 13.9288C15.3086 14.2813 15.125 14.705 15.125 15.2C15.125 15.695 15.3086 16.1188 15.6758 16.4713C16.043 16.8238 16.4844 17 17 17C17.5156 17 17.957 16.8238 18.3242 16.4713ZM17 26C14.4844 23.945 12.6055 22.0363 11.3633 20.2738C10.1211 18.5113 9.5 16.88 9.5 15.38C9.5 13.13 10.2539 11.3375 11.7617 10.0025C13.2695 8.6675 15.0156 8 17 8C18.9844 8 20.7305 8.6675 22.2383 10.0025C23.7461 11.3375 24.5 13.13 24.5 15.38C24.5 16.88 23.8789 18.5113 22.6367 20.2738C21.3945 22.0363 19.5156 23.945 17 26Z"
        fill={fg}
      />
    </svg>
  )
}

function StopMark({ kind }) {
  if (kind === 'source') return <SourceMarkIcon />
  if (kind === 'dest') return <PinMark bg="#E9F9F6" fg="#01B76B" />
  return <PinMark />
}

export function JourneySummaryPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const setOrder = useSetAtom(orderAtom)
  const query = useMemo(() => readQuery(location.search), [location.search])
  const [trip, setTrip] = useState(null)
  const [seats, setSeats] = useState(1)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')

  useEffect(() => {
    if (!query.vehicleId) {
      setStatus('error')
      setError('Vehicle is missing')
      return undefined
    }
    if (query.fromLat == null || query.fromLon == null) {
      setStatus('error')
      setError('from_lat and from_lon are required')
      return undefined
    }
    if (!query.toStopId) {
      setStatus('error')
      setError('Drop stop is missing')
      return undefined
    }
    const controller = new AbortController()
    setStatus('loading')
    fetchRouteCheckout(query, { signal: controller.signal })
      .then((next) => {
        setTrip(next)
        setStatus('ready')
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err?.message || 'Could not load this journey')
        setStatus('error')
      })
    return () => controller.abort()
  }, [
    query.vehicleId,
    query.fromLat,
    query.fromLon,
    query.toStopId,
    query.routeId,
    query.code,
    query.category,
    query.fare,
    query.fromPlace,
    query.toPlace,
    query.toLat,
    query.toLon,
    query.tripId,
    query.fromStopId,
    query.dropStopId,
  ])

  function goBack() {
    const params = new URLSearchParams(query.raw)
    params.delete('seats')
    navigate(`/livebus/route?${params}`)
  }

  async function book() {
    if (!trip || booking) return
    setBooking(true)
    setBookError('')
    try {
      const payload = buildLiveBusOrderPayload({ seats })
      const order = await createOrderAndInitiatePg(payload)
      setOrder(order)
      navigate('/payment?flow=livebus', { replace: true })
    } catch (err) {
      setBookError(err?.message || 'Could not start payment')
      setBooking(false)
    }
  }

  const fare = trip ? trip.fareInr * seats : 0
  const legs = trip?.legs || []

  return (
    <section className="js-page">
      <Header title="Journey Details" onBack={goBack} />
      <div className="js-scroll">
        {status === 'loading' ? <p className="js-status">Loading journey…</p> : null}
        {status === 'error' ? <p className="js-status">{error}</p> : null}
        {trip ? (
          <>
            <article className="js-card js-route">
              <span className="js-badge">
                <BusGlyph size={15} />
                {trip.code}
              </span>
              <div>
                <span className="js-class">{trip.category}</span>
                <p>
                  {trip.fromPlace} → {trip.toPlace}
                </p>
              </div>
              <LiveBusMark />
            </article>

            <article className="js-card js-passengers">
              <span className="js-passengers__icon" aria-hidden="true">
                <PersonIcon />
              </span>
              <div>
                <strong>Add Passengers</strong>
                <span>Adults and children</span>
              </div>
              <div className="js-stepper">
                <button
                  type="button"
                  onClick={() => setSeats((count) => Math.max(1, count - 1))}
                  disabled={seats <= 1}
                  aria-label="Remove passenger"
                >
                  −
                </button>
                <b>{seats}</b>
                <button
                  type="button"
                  onClick={() => setSeats((count) => Math.min(9, count + 1))}
                  aria-label="Add passenger"
                >
                  +
                </button>
              </div>
            </article>

            <article className="js-card js-plan">
              {legs.map((leg, index) => {
                const next = legs[index + 1]
                const gap = next?.distance || ''
                return (
                  <div key={leg.id} className="js-leg">
                    <div className={`js-stop is-${leg.kind}`}>
                      <span className="js-mark" aria-hidden="true">
                        <StopMark kind={leg.kind} />
                      </span>
                      <div>
                        <span>{leg.label}</span>
                        <strong>{leg.name}</strong>
                      </div>
                      {leg.kind === 'board' || leg.kind === 'alight' ? (
                        <button type="button" className="js-edit" aria-label={`Edit ${leg.label}`}>
                          <PencilIcon />
                        </button>
                      ) : (
                        <span className="js-edit-spacer" />
                      )}
                    </div>
                    {gap ? (
                      <div className="js-gap" aria-hidden="true">
                        <span className="js-gap__chip">{gap}</span>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </article>
            {bookError ? <p className="js-status">{bookError}</p> : null}
          </>
        ) : null}
      </div>
      {trip ? (
        <div className="js-bar">
          <button type="button" className="js-book" onClick={book} disabled={booking}>
            {booking ? 'Starting checkout…' : `Book Bus Ticket @ ₹${fare}`}
          </button>
        </div>
      ) : null}
    </section>
  )
}
