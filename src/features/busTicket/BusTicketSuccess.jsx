import { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { fetchOrderPgStatus } from '../../api/orders'
import { TicketQrDisplay } from '../tickets/TicketQrDisplay'
import { BusTicketHeader } from './BusTicketChrome'
import { categoryLabel, displayDate, routeCode, stopTitle } from './format'
import { BusArt, CalendarIcon, IdIcon, PersonIcon, PinIcon, ShieldIcon } from './icons'
import './BusTicket.css'

function useCountdown(targetMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const left = Math.max(0, (targetMs || 0) - now)
  const hours = Math.floor(left / 3600000)
  const minutes = Math.floor((left % 3600000) / 60000)
  const seconds = Math.floor((left % 60000) / 1000)
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0'))
}

function arrivalTarget(clock) {
  const match = String(clock || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return Date.now() + 6 * 3600000
  const target = new Date()
  target.setHours(Number(match[1]), Number(match[2]), Number(match[3] || 0), 0)
  if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1)
  return target.getTime()
}

export function BusTicketSuccess({ draft, orderId }) {
  const [reference, setReference] = useState('')
  const [validUntil, setValidUntil] = useState(null)
  const target = validUntil ? Date.parse(validUntil) : arrivalTarget(draft?.destination?.arrival_time)
  const [hours, minutes, seconds] = useCountdown(Number.isFinite(target) ? target : arrivalTarget(draft?.destination?.arrival_time))
  const code = routeCode(draft?.routeName)
  const category = categoryLabel(draft?.fareCategory || draft?.serviceCategory)
  const seats = Math.max(1, Number(draft?.seats) || 1)
  const fare = Number(draft?.fareInr) || 0

  useEffect(() => {
    if (!orderId) return undefined
    let stop = false
    const pull = () => {
      fetchOrderPgStatus(orderId)
        .then((status) => {
          if (stop) return
          const booking = (status?.bookings || []).find((leg) => leg?.booking_reference_number)
          if (booking?.booking_reference_number) setReference(booking.booking_reference_number)
        })
        .catch(() => {})
    }
    pull()
    const id = window.setInterval(pull, 4000)
    return () => {
      stop = true
      window.clearInterval(id)
    }
  }, [orderId])

  const qrPayload = useMemo(() => reference || orderId || draft?.tripId || 'meeticket', [draft?.tripId, orderId, reference])

  return (
    <section className="bt-page bt-ticket">
      <BusTicketHeader variant="menu" />
      <div className="bt-scroll">
        <button type="button" className="bt-lang">
          తెలుగు &gt;
        </button>
        <h1 className="bt-brand">TGSRTC, HYDERABAD</h1>
        <p className="bt-meta">
          <span>
            <CalendarIcon />
            {displayDate()}
          </span>
          <span>
            <PersonIcon />
            X{seats}
          </span>
          <span>
            <IdIcon />
            ID: {String(orderId || draft?.tripId || '').slice(-6)}
          </span>
        </p>
        <div className="bt-valid">
          <p>Ticket is valid till</p>
          <div className="bt-clock">
            <div className="bt-clock__unit">
              {hours}
              <small>HRS</small>
            </div>
            <span className="bt-clock__colon">:</span>
            <div className="bt-clock__unit">
              {minutes}
              <small>MINS</small>
            </div>
            <span className="bt-clock__colon">:</span>
            <div className="bt-clock__unit">
              {seconds}
              <small>SECS</small>
            </div>
          </div>
        </div>
        <div className="bt-qr">
          {reference ? (
            <TicketQrDisplay
              bookingReferenceNumber={reference}
              fallbackPayload={qrPayload}
              size={180}
              onValidUntil={setValidUntil}
            />
          ) : (
            <QRCode value={qrPayload} size={180} />
          )}
        </div>
        <article className="bt-card">
          <div className="bt-you">
            <p className="bt-you__name">
              <strong>{code}</strong> {category}
            </p>
            <BusArt side />
          </div>
          <div className="bt-place bt-place--plain">
            <PinIcon />
            <div>
              <p className="bt-place__label">Source Stop</p>
              <p className="bt-place__name">{stopTitle(draft?.source)}</p>
            </div>
          </div>
          <div className="bt-place bt-place--fare">
            <PinIcon />
            <div>
              <p className="bt-place__label">Destination Stop</p>
              <p className="bt-place__name">{stopTitle(draft?.destination)}</p>
            </div>
            {fare ? <span className="bt-fare">₹{fare * seats}</span> : null}
          </div>
        </article>
        <p className="bt-conductor">
          <ShieldIcon />
          <span>Show this ticket to the conductor while boarding the bus</span>
        </p>
      </div>
    </section>
  )
}
