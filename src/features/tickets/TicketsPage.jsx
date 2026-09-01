import { useCallback, useEffect, useMemo, useState } from 'react'
import tgsrtcLogo from '../../assets/brands/tgsrtc.png'
import {
  AppLogo,
  BackIcon,
  CalendarIcon,
  CashBillIcon,
  ClockIcon,
  CloseIcon,
  InfoIcon,
  ModeIcon,
  PencilIcon,
  PhoneIcon,
  PinIcon,
} from '../../components/icons'
import {
  CANCEL_REASONS,
  firstEnabledTabId,
  getCabProviderLogo,
  getTabJourneys,
  isTabEnabled,
  normalizeBooking,
  PRIMARY_TICKET_TABS,
  secondsUntilValidUntil,
} from '../../constants/tickets'
import { TicketQrDisplay } from './TicketQrDisplay'
import { OtpQrCode } from './OtpQrCode'
import { QrCode } from './QrCode'
import './tickets.tokens.css'
import './TicketsPage.css'
import './TicketsPage.bus.css'
import './TicketsPage.cab.css'

function TicketsHeader({ onBack, onCall }) {
  return (
    <header className="mt-tickets__header">
      <button type="button" className="mt-tickets__icon-btn" onClick={onBack} aria-label="Go back">
        <BackIcon size={28} />
      </button>
      <AppLogo width={60} height={58} className="mt-tickets__logo" />
      <button type="button" className="mt-tickets__call-btn" onClick={onCall} aria-label="Call support">
        <PhoneIcon size={24} />
      </button>
    </header>
  )
}

function ModeTabs({ activeId, enabledById, onChange }) {
  return (
    <div className="mt-tickets__tabs" role="tablist" aria-label="Ticket modes">
      {PRIMARY_TICKET_TABS.map((tab) => {
        const active = tab.id === activeId
        const disabled = !enabledById[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-disabled={disabled}
            disabled={disabled}
            className={`mt-tickets__tab${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
            data-tab={tab.id}
            onClick={() => onChange(tab.id)}
          >
            <ModeIcon mode={tab.mode} size={20} className="mt-tickets__tab-icon" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function JourneyTabs({ journeys, activeIndex, onChange }) {
  return (
    <div className="mt-journey-tabs" role="tablist" aria-label="Journey segments">
      {journeys.map((journey, index) => {
        const active = index === activeIndex
        return (
          <button
            key={journey.id ?? `journey-${index}`}
            type="button"
            role="tab"
            aria-selected={active}
            className={`mt-journey-tabs__chip${active ? ' is-active' : ''}`}
            onClick={() => onChange(index)}
          >
            {`JOURNEY ${index + 1}`}
          </button>
        )
      })}
    </div>
  )
}

function CabRouteTimeline({ from, to, fromRole, toRole, durationMin }) {
  return (
    <div className="mt-cab-route">
      <div className="mt-cab-route__duration">
        <ClockIcon size={18} className="mt-cab-route__clock" />
        <span>{durationMin} Min</span>
      </div>
      <div className="mt-cab-route__stops">
        <div className="mt-cab-route__stop">
          <div className="mt-cab-route__icon-col" aria-hidden="true">
            <span className="mt-cab-route__dot" />
            <span className="mt-cab-route__line" />
          </div>
          <div className="mt-cab-route__text">
            <strong className="mt-cab-route__name">{from}</strong>
            {fromRole ? <span className="mt-cab-route__label">{fromRole}</span> : null}
          </div>
        </div>
        <div className="mt-cab-route__stop">
          <div className="mt-cab-route__icon-col" aria-hidden="true">
            <span className="mt-cab-route__sq" />
          </div>
          <div className="mt-cab-route__text">
            <strong className="mt-cab-route__name">{to}</strong>
            {toRole ? <span className="mt-cab-route__label">{toRole}</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function CabTicket({ ticket, onCancel }) {
  const pin = String(ticket.pin || '').trim()
  const providerLogo = getCabProviderLogo(ticket.providerId)
  const showFare = ticket.fareInr != null && Number(ticket.fareInr) > 0

  return (
    <div className="mt-ticket mt-ticket--cab">
      <article className="mt-cab-trip-card">
        <div className="mt-cab-trip-card__provider">
          <div className="mt-cab-trip-card__brand">
            {providerLogo ? (
              <img className="mt-cab-trip-card__logo" src={providerLogo} alt="" draggable={false} />
            ) : null}
            <span className="mt-cab-trip-card__title">{ticket.title}</span>
          </div>
          {showFare ? <strong className="mt-cab-trip-card__fare">₹{ticket.fareInr}</strong> : null}
        </div>

        <div className="mt-cab-trip-card__divider" role="presentation" />

        <div className="mt-cab-trip-card__datetime">
          <CalendarIcon size={18} />
          <span>{ticket.datetime}</span>
        </div>

        <div className="mt-cab-trip-card__divider" role="presentation" />

        <CabRouteTimeline
          from={ticket.from}
          to={ticket.to}
          fromRole={ticket.fromRole}
          toRole={ticket.toRole}
          durationMin={ticket.durationMin}
        />

        <div className="mt-cab-trip-card__divider" role="presentation" />

        <div className="mt-cab-trip-card__driver">
          <div className="mt-cab-trip-card__driver-visual">
            <div className="mt-cab-trip-card__avatar-wrap">
              <span className="mt-cab-trip-card__avatar">{ticket.driver.photoInitials}</span>
              {ticket.driver.rating ? (
                <span className="mt-cab-trip-card__rating">{ticket.driver.rating}</span>
              ) : null}
            </div>
            <img
              className="mt-cab-trip-card__vehicle"
              src={ticket.driver.vehicleImage}
              alt=""
              draggable={false}
            />
          </div>
          <div className="mt-cab-trip-card__driver-copy">
            <strong>{ticket.driver.vehicleNo}</strong>
            <span>{ticket.driver.vehicleModel}</span>
            <span className="mt-cab-trip-card__driver-name">{ticket.driver.name}</span>
          </div>
        </div>

        <button type="button" className="mt-cab-trip-card__track">
          <PinIcon size={18} color="currentColor" />
          Live Tracking
        </button>
      </article>

      {pin ? (
        <article className="mt-cab-otp-card">
          <div className="mt-cab-otp-card__header">
            <span className="mt-cab-otp-card__label">Share PIN</span>
            <div className="mt-cab-otp-card__digits" aria-label={`PIN ${pin}`}>
              {pin.split('').map((digit, index) => (
                <span key={`${digit}-${index}`} className="mt-cab-otp-card__digit">
                  {digit}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-cab-otp-card__body">
            <OtpQrCode value={pin} size={200} className="mt-qr mt-qr--cab-framed" />
          </div>
        </article>
      ) : null}

      <article className="mt-cab-bottom-card">
        <p className="mt-cab-bottom-card__title">Trip Details</p>
        <p className="mt-cab-bottom-card__body">{ticket.tripDetails}</p>
        <div className="mt-cab-bottom-card__actions">
          <span className="mt-cab-bottom-card__pay">
            <CashBillIcon size={20} />
            {ticket.paymentMethod || 'Cash'}
          </span>
          {ticket.canCancel ? (
            <button type="button" className="mt-cab-bottom-card__cancel" onClick={onCancel}>
              Cancel Ride
            </button>
          ) : null}
        </div>
      </article>
    </div>
  )
}

function BusRouteTimeline({ from, to, fromEditable = false }) {
  return (
    <div className="mt-bus-route">
      <div className="mt-bus-route__stop">
        <div className="mt-bus-route__icon-col" aria-hidden="true">
          <span className="mt-bus-route__dot" />
          <span className="mt-bus-route__line" />
        </div>
        <div className="mt-bus-route__text">
          <div className="mt-bus-route__row">
            <strong className="mt-bus-route__name">{from}</strong>
            {fromEditable ? (
              <button type="button" className="mt-bus-route__edit-btn" aria-label="Edit boarding point">
                <PencilIcon size={13} />
              </button>
            ) : null}
          </div>
          <span className="mt-bus-route__label">Boarding</span>
        </div>
      </div>
      <div className="mt-bus-route__stop">
        <div className="mt-bus-route__icon-col" aria-hidden="true">
          <span className="mt-bus-route__sq" />
        </div>
        <div className="mt-bus-route__text">
          <strong className="mt-bus-route__name">{to}</strong>
          <span className="mt-bus-route__label">Alighting</span>
        </div>
      </div>
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
        <div className="mt-ticket-route__stop">
          <strong>{from}</strong>
          {fromRole ? <small>{fromRole}</small> : null}
        </div>
        {durationMin != null ? <span className="mt-ticket-route__dur">{durationMin} Min</span> : null}
        <div className="mt-ticket-route__stop">
          <strong>{to}</strong>
          {toRole ? <small>{toRole}</small> : null}
        </div>
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
        <TicketQrDisplay
          bookingReferenceNumber={ticket.bookingReferenceNumber}
          fallbackPayload={ticket.qrPayload}
          size={180}
        />
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

function CountdownDotSep() {
  return (
    <span className="mt-countdown__dots" aria-hidden="true">
      <span />
      <span />
    </span>
  )
}

function BusPassengerRow({ adult, child }) {
  return (
    <div className="mt-bus-meta__pax">
      <span>Adult: {adult}</span>
      <span className="mt-bus-meta__pax-dot" aria-hidden="true" />
      <span>Child: {child}</span>
    </div>
  )
}

function BusCountdown({ clock }) {
  return (
    <div
      className="mt-countdown"
      aria-label={`${clock.hrs} hours ${clock.mns} minutes ${clock.secs} seconds`}
    >
      <div className="mt-countdown__row">
        <strong>{clock.hrs}</strong>
        <CountdownDotSep />
        <strong>{clock.mns}</strong>
        <CountdownDotSep />
        <strong>{clock.secs}</strong>
      </div>
      <div className="mt-countdown__row mt-countdown__row--labels">
        <small>HRS</small>
        <CountdownDotSep />
        <small>MNS</small>
        <CountdownDotSep />
        <small>secs</small>
      </div>
    </div>
  )
}

function BusTicket({ ticket, onDropService }) {
  const [remaining, setRemaining] = useState(ticket.validSeconds ?? 0)
  const [qrKey, setQrKey] = useState(0)
  const hasLiveQr = Boolean(ticket.bookingReferenceNumber)

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((n) => (n > 0 ? n - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const handleValidUntil = useCallback((validUntil) => {
    const seconds = secondsUntilValidUntil(validUntil)
    if (seconds != null) setRemaining(seconds)
  }, [])

  const clock = formatCountdown(remaining)
  const pax = ticket.passengers

  return (
    <div className="mt-ticket mt-ticket--bus">
      <article className="mt-bus-card">
        <header className="mt-bus-card__banner">
          <span className="mt-bus-card__pnr">PNR: {ticket.pnr}</span>
          <strong className="mt-bus-card__fare">₹{ticket.fareInr}</strong>
        </header>
        <div className="mt-bus-card__body">
          <div className="mt-bus-meta">
            <div className="mt-bus-meta__item">
              <span className="mt-bus-meta__label">Issued On</span>
              <strong className="mt-bus-meta__value">{ticket.issuedOn}</strong>
            </div>
            <div className="mt-bus-meta__item">
              <span className="mt-bus-meta__label right">Passenger</span>
              <BusPassengerRow adult={pax.adult} child={pax.child} />
            </div>
          </div>
          <BusRouteTimeline from={ticket.from} to={ticket.to} fromEditable />
        </div>
      </article>

      <article className="mt-bus-qr-card">
        <div className="mt-bus-qr-card__top">
          <div className="mt-bus-validity">
            <span className="mt-bus-validity__label">Ticket is Valid Till</span>
            <BusCountdown clock={clock} />
          </div>
          <img className="mt-bus-qr-card__emblem" src={tgsrtcLogo} alt="TGSRTC" draggable={false} />
        </div>

        <div className="mt-bus-qr-card__code">
          {hasLiveQr ? (
            <TicketQrDisplay
              bookingReferenceNumber={ticket.bookingReferenceNumber}
              fallbackPayload={ticket.qrPayload}
              size={179}
              refreshable
              onValidUntil={handleValidUntil}
            />
          ) : (
            <>
              <QrCode payload={`${ticket.qrPayload}-${qrKey}`} size={179} className="mt-qr mt-qr--framed" />
              <div className="mt-bus-actions">
                <span className="mt-bus-valid">{ticket.status}</span>
                <button type="button" className="mt-bus-refresh mt-bus-refresh--outline" onClick={() => setQrKey((n) => n + 1)}>
                  Refresh QR
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mt-bus-info">
          <InfoIcon size={24} className="mt-bus-info__icon" />
          <p>{ticket.instruction}</p>
        </div>
      </article>

      <button type="button" className="mt-bus-drop" onClick={onDropService}>
        Drop Service
      </button>

      <div className="mt-bus-terms">
        <InfoIcon size={24} className="mt-bus-terms__icon" />
        <p>{ticket.terms}</p>
      </div>
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

function EmptyTabPanel({ tabLabel }) {
  return (
    <div className="mt-ticket mt-ticket--empty">
      <p className="mt-ticket-empty">No {tabLabel} ticket for this booking.</p>
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

function renderTicket(ticket, { onCancel, onDropService, busKey }) {
  if (!ticket) return <p className="mt-ticket-empty">No ticket for this journey.</p>

  if (ticket.pending || ticket.bookingState === 'pending') {
    return (
      <div className="mt-ticket mt-ticket--pending">
        <p className="mt-ticket-empty">{ticket.message || 'Confirming booking…'}</p>
      </div>
    )
  }

  if (ticket.bookingState === 'failed') {
    return (
      <div className="mt-ticket mt-ticket--failed">
        <p className="mt-ticket-empty">{ticket.message || 'Booking failed.'}</p>
      </div>
    )
  }

  switch (ticket.type) {
    case 'cab':
      return <CabTicket ticket={ticket} onCancel={onCancel} />
    case 'metro':
      return <MetroTicket ticket={ticket} />
    case 'bus':
      return <BusTicket key={busKey} ticket={ticket} onDropService={onDropService} />
    case 'other':
      return <OtherTicket ticket={ticket} />
    default:
      return <p className="mt-ticket-empty">Unsupported ticket type ({ticket.legType || ticket.type}).</p>
  }
}

export function TicketsPage({ booking, onBack, onCall, onCancelled, onDropService }) {
  const normalized = normalizeBooking(booking)
  const [tabId, setTabId] = useState(() =>
    firstEnabledTabId(normalized, normalized?.defaultTab ?? 'bus'),
  )
  const [journeyIndex, setJourneyIndex] = useState(0)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reasonId, setReasonId] = useState('find-driver')

  const enabledById = useMemo(() => {
    const map = {}
    for (const tab of PRIMARY_TICKET_TABS) {
      map[tab.id] = isTabEnabled(normalized, tab.id)
    }
    return map
  }, [normalized])

  const journeys = getTabJourneys(normalized, tabId)
  const ticket = journeys[journeyIndex] ?? journeys[0]
  const showJourneyTabs = journeys.length > 1
  const activeTab = PRIMARY_TICKET_TABS.find((tab) => tab.id === tabId)

  useEffect(() => {
    setJourneyIndex(0)
  }, [tabId])

  useEffect(() => {
    if (!normalized || isTabEnabled(normalized, tabId)) return
    setTabId(firstEnabledTabId(normalized))
  }, [normalized, tabId])

  if (!normalized) {
    return (
      <section className="mt-tickets">
        <TicketsHeader onBack={onBack} onCall={onCall} />
        <ModeTabs activeId="bus" enabledById={{ metro: false, bus: false, cab: false, other: false }} onChange={() => {}} />
        <p className="mt-ticket-empty">No active booking found.</p>
      </section>
    )
  }

  const busKey = `${normalized.id}-${tabId}-${ticket?.id ?? journeyIndex}`
  const tabEnabled = isTabEnabled(normalized, tabId)

  return (
    <section className="mt-tickets">
      <TicketsHeader onBack={onBack} onCall={onCall} />
      {normalized.isPolling ? (
        <p className="mt-tickets__polling" role="status">
          Confirming your bookings…
        </p>
      ) : null}
      <ModeTabs activeId={tabId} enabledById={enabledById} onChange={setTabId} />
      {showJourneyTabs ? (
        <JourneyTabs journeys={journeys} activeIndex={journeyIndex} onChange={setJourneyIndex} />
      ) : null}

      <div className="mt-tickets__body" role="tabpanel">
        {tabEnabled
          ? renderTicket(ticket, {
              onCancel: () => setCancelOpen(true),
              onDropService,
              busKey,
            })
          : (
            <EmptyTabPanel tabLabel={activeTab?.label ?? 'ticket'} />
          )}
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
