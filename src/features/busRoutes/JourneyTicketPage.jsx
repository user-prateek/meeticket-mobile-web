import { useEffect, useMemo, useState } from 'react'
import QRCode from 'react-qr-code'
import { useLocation } from 'react-router-dom'
import meeticketSeal from '../../assets/brands/meeticket.png'
import { fetchOrderPgStatus } from '../../api/orders'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { TicketQrDisplay } from '../tickets/TicketQrDisplay'
import { mapPgStatusToLiveBusTicket } from './mapPgTicket'
import { LIVEBUS_SAMPLE_ORDER_ID } from './sampleOrder'
import { LiveBusMark } from './LiveBusMark'
import './JourneyTicketPage.css'

function readQuery(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return {
    orderId: params.get('order') || params.get('order_id') || LIVEBUS_SAMPLE_ORDER_ID,
    raw: params,
  }
}

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

function parseValidUntil(value) {
  if (!value) return null
  const raw = String(value)
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

function MetaIcon({ kind }) {
  if (kind === 'date') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M2 6.5h12M5 2v2.5M11 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'seat') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="5.2" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3.8 13c.8-2 2.3-3 4.2-3s3.4 1 4.2 3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="3" width="12" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Livebus success UI (`/livebus/ticket?order=ORD-…`).
 * Borrows journey orders `pg/status` (+ QR API); UI stays livebus-specific.
 */
export function JourneyTicketPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const query = useMemo(() => readQuery(location.search), [location.search])
  const [ticket, setTicket] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [qrValidUntil, setQrValidUntil] = useState(null)
  const [qrKey, setQrKey] = useState(0)

  const targetMs = useMemo(() => {
    const fromQr = parseValidUntil(qrValidUntil)
    if (fromQr) return fromQr
    return parseValidUntil(ticket?.validUntil) || Date.now()
  }, [qrValidUntil, ticket?.validUntil])
  const [hours, minutes, seconds] = useCountdown(targetMs)
  const expired = targetMs <= Date.now()

  useEffect(() => {
    if (!query.orderId) {
      setError('Order is missing')
      setLoading(false)
      return undefined
    }
    // Local cancel only — do not abort shared pg/status (StrictMode + dedupeInFlight).
    let cancelled = false
    setLoading(true)
    setError('')
    fetchOrderPgStatus(query.orderId)
      .then((status) => {
        if (cancelled) return
        const next = mapPgStatusToLiveBusTicket(status, { orderId: query.orderId })
        if (!next) throw new Error('No bus booking found for this order')
        setTicket(next)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err?.message || 'Could not load this ticket')
        setTicket(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [query.orderId])

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/livebus')
  }

  const qrFallback = ticket?.reference || ticket?.orderId || 'meeticket'

  return (
    <section className="tk-page">
      <header className="tk-header">
        <button type="button" className="tk-back" onClick={goBack} aria-label="Go back">
          ‹
        </button>
        <h1>TGSRTC Hyderabad</h1>
        <button type="button" className="tk-lang">
          తెలుగు <span aria-hidden="true">›</span>
        </button>
      </header>
      <div className="tk-scroll">
        {loading ? <p className="tk-status">Loading your ticket…</p> : null}
        {error ? <p className="tk-status">{error}</p> : null}
        {ticket ? (
          <>
            <article className="tk-card">
              <div className="tk-meta">
                <span>
                  <MetaIcon kind="date" />
                  {ticket.date || '—'}
                </span>
                <span>
                  <MetaIcon kind="seat" />
                  X{ticket.seats}
                </span>
                <span>
                  <MetaIcon kind="id" />
                  ID: {ticket.passengerId || '—'}
                </span>
              </div>
              <div className="tk-valid">
                <div>
                  <p>{expired ? 'Ticket expired' : 'Ticket is Valid Till'}</p>
                  <strong>
                    {hours} : {minutes} : {seconds}
                  </strong>
                  <small>
                    <span>HRS</span>
                    <span>MNS</span>
                    <span>SECS</span>
                  </small>
                </div>
                <img src={meeticketSeal} alt="MeeTicket" />
              </div>
              <div className="tk-qr">
                {ticket.reference ? (
                  <TicketQrDisplay
                    key={qrKey}
                    bookingReferenceNumber={ticket.reference}
                    fallbackPayload={qrFallback}
                    size={196}
                    className="tk-qr__display"
                    expired={expired}
                    onValidUntil={setQrValidUntil}
                  />
                ) : (
                  <QRCode value={qrFallback} size={196} />
                )}
              </div>
              <div className="tk-actions">
                <span className={`tk-valid-pill${expired ? ' is-expired' : ''}`}>
                  <i aria-hidden="true">{expired ? '×' : '✓'}</i> {expired ? 'Expired' : 'Valid'}
                </span>
                <button type="button" onClick={() => setQrKey((key) => key + 1)} disabled={expired}>
                  <span aria-hidden="true">↻</span> Refresh QR
                </button>
              </div>
              <p className="tk-note">
                <i aria-hidden="true">i</i>
                Show this QR code at the entry gate/ validator for a smooth journey.
              </p>
            </article>

            <article className="tk-card tk-ride">
              <div className="tk-ride__head">
                <strong>
                  {ticket.code} {String(ticket.category).toUpperCase()}
                </strong>
                <LiveBusMark />
              </div>
              <div className="tk-ride__stop">
                <span className="tk-pin" aria-hidden="true" />
                <div>
                  <span>Source Stop</span>
                  <strong>{ticket.boardingStop}</strong>
                </div>
              </div>
              <div className="tk-ride__stop">
                <span className="tk-pin" aria-hidden="true" />
                <div>
                  <span>Destination Stop</span>
                  <strong>{ticket.alightingStop}</strong>
                </div>
                <b>₹{ticket.fareInr}</b>
              </div>
            </article>
          </>
        ) : null}
      </div>
    </section>
  )
}
