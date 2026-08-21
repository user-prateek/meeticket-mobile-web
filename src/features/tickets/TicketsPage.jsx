import { useEffect, useState } from 'react'
import { AppLogo, BackIcon, CloseIcon, ModeIcon, PencilIcon, PhoneIcon } from '../../components/icons'
import { CANCEL_REASONS } from '../../constants/tickets'
import { QrCode } from './QrCode'
import './TicketsPage.css'

function TicketsHeader({ onBack, onCall }) {
  return (
    <header className="mt-tickets__header">
      <button type="button" className="mt-tickets__icon-btn" onClick={onBack} aria-label="Go back">
        <BackIcon size={22} />
      </button>
      <AppLogo size={40} className="mt-tickets__logo" />
      <button type="button" className="mt-tickets__icon-btn" onClick={onCall} aria-label="Call support">
        <PhoneIcon size={22} />
      </button>
    </header>
  )
}

function ModeTabs({ tabs, activeId, onChange }) {
  return (
    <div className="mt-tickets__tabs" role="tablist" aria-label="Ticket modes">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`mt-tickets__tab${active ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            {tab.mode !== 'other' ? (
              <ModeIcon mode={tab.mode === 'cab' ? 'cab' : tab.mode} size={18} className="mt-tickets__tab-icon" />
            ) : (
              <span className="mt-tickets__tab-dot" aria-hidden="true" />
            )}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function SharePin({ pin, fareInr }) {
  const digits = String(pin).split('')
  return (
    <div className="mt-share-pin">
      <div className="mt-share-pin__left">
        <span className="mt-share-pin__label">Share PIN</span>
        <div className="mt-share-pin__digits" aria-label={`PIN ${pin}`}>
          {digits.map((d, i) => (
            <span key={`${d}-${i}`}>{d}</span>
          ))}
        </div>
      </div>
      <strong className="mt-share-pin__fare">₹{fareInr}</strong>
    </div>
  )
}

function RouteRail({ from, to, fromRole, toRole, durationMin }) {
  return (
    <div className="mt-ticket-route">
      <div className="mt-ticket-route__rail" aria-hidden="true">
        <span className="mt-ticket-route__dot" />
        <span className="mt-ticket-route__line" />
        <span className="mt-ticket-route__sq" />
      </div>
      <div className="mt-ticket-route__copy">
        <div>
          <strong>{from}</strong>
          {fromRole ? <small>{fromRole}</small> : null}
        </div>
        {durationMin != null ? <span className="mt-ticket-route__dur">{durationMin} Min</span> : null}
        <div>
          <strong>{to}</strong>
          {toRole ? <small>{toRole}</small> : null}
        </div>
      </div>
    </div>
  )
}

function CabTicket({ ticket, onCancel }) {
  return (
    <div className="mt-ticket mt-ticket--cab">
      <SharePin pin={ticket.pin} fareInr={ticket.fareInr} />

      <div className="mt-ticket-card">
        <div className="mt-ticket-card__meta">
          <span>{ticket.datetime}</span>
          <span>Pax: {ticket.pax}</span>
        </div>
        <RouteRail
          from={ticket.from}
          to={ticket.to}
          fromRole={ticket.fromRole}
          toRole={ticket.toRole}
          durationMin={ticket.durationMin}
        />
      </div>

      <div className="mt-driver">
        <div className="mt-driver__avatar" aria-hidden="true">
          {ticket.driver.photoInitials}
        </div>
        <img className="mt-driver__vehicle" src={ticket.driver.vehicleImage} alt="" draggable={false} />
        <div className="mt-driver__copy">
          <strong>{ticket.driver.vehicleNo}</strong>
          <span>{ticket.driver.vehicleModel}</span>
          <span className="mt-driver__name">{ticket.driver.name}</span>
        </div>
      </div>

      <div className="mt-ticket-card mt-ticket-card--qr">
        <p className="mt-ticket-card__title">Scan QR Code</p>
        <QrCode payload={ticket.qrPayload} size={168} className="mt-qr" />
      </div>

      <div className="mt-ticket-card mt-ticket-card--details">
        <p className="mt-ticket-card__title">Trip Details</p>
        <p className="mt-ticket-card__body">{ticket.tripDetails}</p>
      </div>

      <div className="mt-ticket-footer">
        <div className="mt-ticket-pay">
          <span className="mt-ticket-pay__badge">Cash</span>
        </div>
        {ticket.canCancel ? (
          <button type="button" className="mt-ticket-footer__cancel" onClick={onCancel}>
            Cancel Ride
          </button>
        ) : null}
      </div>
    </div>
  )
}

function MetroTicket({ ticket }) {
  return (
    <div className="mt-ticket mt-ticket--metro">
      <div className="mt-ticket-card">
        <div className="mt-ticket-card__head">
          <div>
            <span className="mt-ticket-card__muted">Ref ID: {ticket.refId}</span>
            <div className="mt-ticket-card__meta">
              <span>{ticket.datetime}</span>
              <span>Pax: {ticket.pax}</span>
            </div>
          </div>
          <strong className="mt-ticket-card__fare">₹{ticket.fareInr}</strong>
        </div>

        <div className="mt-metro-badge-row">
          <span className="mt-metro-platform">Platform No: {ticket.platformNo}</span>
          <span className="mt-metro-oneway">{ticket.tripType}</span>
        </div>

        <RouteRail from={ticket.from} to={ticket.to} />
      </div>

      <div className="mt-ticket-card mt-ticket-card--valid">
        <div>
          <span className="mt-ticket-card__muted">Valid till</span>
          <strong>{ticket.validTill}</strong>
        </div>
        <AppLogo size={36} />
      </div>

      <div className="mt-ticket-card mt-ticket-card--qr">
        <QrCode payload={ticket.qrPayload} size={180} className="mt-qr" />
        <p className="mt-qr-hint">{ticket.qrHint}</p>
      </div>
    </div>
  )
}

function formatCountdown(totalSeconds) {
  const s = Math.max(0, totalSeconds)
  const hrs = String(Math.floor(s / 3600)).padStart(2, '0')
  const mns = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const secs = String(s % 60).padStart(2, '0')
  return { hrs, mns, secs }
}

function BusTicket({ ticket }) {
  const [remaining, setRemaining] = useState(ticket.validSeconds ?? 0)
  const [qrKey, setQrKey] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((n) => (n > 0 ? n - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const clock = formatCountdown(remaining)
  const pax = ticket.passengers

  return (
    <div className="mt-ticket mt-ticket--bus">
      <div className="mt-ticket-card">
        <div className="mt-ticket-card__head">
          <div>
            <strong className="mt-ticket-card__pnr">PNR: {ticket.pnr}</strong>
            <div className="mt-ticket-card__meta">
              <span>Issued On {ticket.issuedOn}</span>
            </div>
            <p className="mt-ticket-card__pax">
              Passenger · Adult: {pax.adult} • Child: {pax.child}
            </p>
          </div>
          <strong className="mt-ticket-card__fare">₹{ticket.fareInr}</strong>
        </div>

        <div className="mt-bus-stops">
          <div className="mt-bus-stops__from">
            <strong>{ticket.from}</strong>
            <PencilIcon size={14} className="mt-bus-stops__edit" />
          </div>
          <span className="mt-bus-stops__arrow" aria-hidden="true">
            →
          </span>
          <strong>{ticket.to}</strong>
        </div>
      </div>

      <div className="mt-ticket-card mt-ticket-card--timer">
        <span className="mt-ticket-card__muted">Ticket is Valid Till</span>
        <div className="mt-countdown" aria-label={`${clock.hrs} hours ${clock.mns} minutes ${clock.secs} seconds`}>
          <div>
            <strong>{clock.hrs}</strong>
            <small>HRS</small>
          </div>
          <span>:</span>
          <div>
            <strong>{clock.mns}</strong>
            <small>MNS</small>
          </div>
          <span>:</span>
          <div>
            <strong>{clock.secs}</strong>
            <small>SECS</small>
          </div>
        </div>
      </div>

      <div className="mt-ticket-card mt-ticket-card--qr">
        <QrCode payload={`${ticket.qrPayload}-${qrKey}`} size={180} className="mt-qr" />
        <div className="mt-bus-actions">
          <span className="mt-bus-valid">{ticket.status}</span>
          <button type="button" className="mt-bus-refresh" onClick={() => setQrKey((n) => n + 1)}>
            Refresh QR
          </button>
        </div>
      </div>

      <div className="mt-bus-info">{ticket.instruction}</div>
      <div className="mt-bus-terms">{ticket.terms}</div>
    </div>
  )
}

function OtherTicket({ ticket }) {
  return (
    <div className="mt-ticket mt-ticket--other">
      <p className="mt-ticket-empty">{ticket.message}</p>
    </div>
  )
}

function CancelTripModal({ open, reasonId, onReason, onClose, onSkip, onConfirm }) {
  if (!open) return null

  return (
    <div className="mt-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="mt-cancel-title">
      <button type="button" className="mt-cancel-modal__backdrop" aria-label="Dismiss" onClick={onClose} />
      <div className="mt-cancel-modal__sheet">
        <div className="mt-cancel-modal__top">
          <button type="button" className="mt-cancel-modal__icon" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
          <h2 id="mt-cancel-title">Cancel Trip?</h2>
          <button type="button" className="mt-cancel-modal__skip" onClick={onSkip}>
            Skip
          </button>
        </div>

        <p className="mt-cancel-modal__prompt">Why do you want to cancel?</p>

        <ul className="mt-cancel-modal__list">
          {CANCEL_REASONS.map((reason) => (
            <li key={reason.id}>
              <label className={`mt-cancel-modal__option${reasonId === reason.id ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="cancel-reason"
                  value={reason.id}
                  checked={reasonId === reason.id}
                  onChange={() => onReason(reason.id)}
                />
                <span>{reason.label}</span>
              </label>
            </li>
          ))}
        </ul>

        <button type="button" className="mt-cancel-modal__cta" onClick={onConfirm} disabled={!reasonId}>
          Cancel Ride
        </button>
      </div>
    </div>
  )
}

export function TicketsPage({ booking, onBack, onCall, onCancelled }) {
  const [tabId, setTabId] = useState(booking?.defaultTab ?? booking?.tabs?.[0]?.id ?? 'cab')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reasonId, setReasonId] = useState('find-driver')

  if (!booking) {
    return (
      <section className="mt-tickets">
        <TicketsHeader onBack={onBack} onCall={onCall} />
        <p className="mt-ticket-empty">No active booking found.</p>
      </section>
    )
  }

  const ticket = booking.tickets[tabId]

  return (
    <section className="mt-tickets">
      <TicketsHeader onBack={onBack} onCall={onCall} />
      <ModeTabs tabs={booking.tabs} activeId={tabId} onChange={setTabId} />

      <div className="mt-tickets__body" role="tabpanel">
        {ticket?.type === 'cab' ? (
          <CabTicket ticket={ticket} onCancel={() => setCancelOpen(true)} />
        ) : null}
        {ticket?.type === 'metro' ? <MetroTicket ticket={ticket} /> : null}
        {ticket?.type === 'bus' ? (
          <BusTicket key={`${booking.id}-bus-${ticket.pnr}`} ticket={ticket} />
        ) : null}
        {ticket?.type === 'other' ? <OtherTicket ticket={ticket} /> : null}
      </div>

      <CancelTripModal
        open={cancelOpen}
        reasonId={reasonId}
        onReason={setReasonId}
        onClose={() => setCancelOpen(false)}
        onSkip={() => setCancelOpen(false)}
        onConfirm={() => {
          setCancelOpen(false)
          onCancelled?.({ reasonId })
        }}
      />
    </section>
  )
}
