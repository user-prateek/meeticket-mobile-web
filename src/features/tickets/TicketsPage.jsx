import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import tgsrtcLogo from '../../assets/brands/tgsrtc.png'
import hyderabadMetroLogo from '../../assets/brands/hyderabad-metro.png'
import metroTabIcon from '../../assets/icons/metro.png'
import {
  AppLogo,
  BackIcon,
  CalendarIcon,
  CashBillIcon,
  ClockIcon,
  CloseIcon,
  InfoIcon,
  MapGuideIcon,
  ModeIcon,
  PencilIcon,
  PersonIcon,
  PhoneIcon,
} from '../../components/icons'
import {
  CANCEL_REASONS,
  getCabProviderLogo,
  getTabJourneys,
  isTabEnabled,
  normalizeBooking,
  PRIMARY_TICKET_TABS,
  secondsUntilValidUntil,
} from '../../constants/tickets'
import { ExpiredQrFrame, TicketQrDisplay } from './TicketQrDisplay'
import { TicketQrFlip } from './TicketQrFlip'
import { MapGuidePopup } from './MapGuidePopup'
import { OtpQrCode } from './OtpQrCode'
import { QrCode } from './QrCode'
import { buildMapGuideOptions } from '../../lib/mapGuide'
import './tickets.tokens.css'
import './TicketsPage.css'
import './TicketsPage.bus.css'
import './TicketsPage.cab.css'
import './TicketsPage.metro.css'
import './TicketsPage.qr-flip.css'

function TicketsHeader({ onBack, onCall, mapGuideOpen, onMapGuide, mapGuideOptions }) {
  return (
    <header className="mt-tickets__header">
      <button type="button" className="mt-tickets__icon-btn" onClick={onBack} aria-label="Go back">
        <BackIcon size={28} />
      </button>
      <AppLogo width={60} height={58} className="mt-tickets__logo" />
      <div className="mt-tickets__header-actions">
        <div className="mt-tickets__map-guide-wrap">
          <button
            type="button"
            className={`mt-tickets__map-guide${mapGuideOpen ? ' is-open' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onMapGuide?.()
            }}
            aria-label="Map Guide"
            aria-expanded={mapGuideOpen}
            aria-haspopup="dialog"
          >
            <MapGuideIcon size={18} className="mt-tickets__map-guide-icon" />
            <span className="mt-tickets__map-guide-label">
              <span>Map</span>
              <span>Guide</span>
            </span>
          </button>
          <MapGuidePopup
            open={mapGuideOpen}
            options={mapGuideOptions}
            onClose={() => onMapGuide?.(false)}
          />
        </div>
        <button type="button" className="mt-tickets__call-btn" onClick={onCall} aria-label="Call support">
          <PhoneIcon size={18} />
        </button>
      </div>
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
  const durationLabel = durationMin != null && durationMin > 0 ? `${durationMin} Min` : '—'
  return (
    <div className="mt-cab-route">
      <div className="mt-cab-route__duration">
        <ClockIcon className="mt-cab-route__clock" />
        <span>{durationLabel}</span>
      </div>
      <div className="mt-cab-route__content">
        <div className="mt-cab-route__stop mt-cab-route__stop--from">
          <div className="mt-cab-route__icon-col" aria-hidden="true">
            <span className="mt-cab-route__dot" />
            <span className="mt-cab-route__line" />
          </div>
          <div className="mt-cab-route__text">
            <strong className="mt-cab-route__name">{from}</strong>
            {fromRole ? <span className="mt-cab-route__label">{fromRole}</span> : null}
          </div>
        </div>
        <div className="mt-cab-route__stop mt-cab-route__stop--to">
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

function CabTicket({ ticket, onCancel, qrFlipDirection }) {
  const cancelled = ticket.bookingState === 'cancelled'
  const pin = cancelled ? '' : String(ticket.pin || '').trim()
  const providerLogo = getCabProviderLogo(ticket.providerId)
  const showFare = ticket.fareInr != null && Number(ticket.fareInr) > 0
  const showDriver = Boolean(
    ticket.driver?.name ||
      ticket.driver?.vehicleNo ||
      ticket.driver?.vehicleModel ||
      ticket.driver?.rating,
  )

  return (
    <div className={`mt-ticket mt-ticket--cab${cancelled ? ' is-cancelled' : ''}`}>
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

        <div className="mt-cab-trip-card__meta">
          <span className="mt-cab-trip-card__meta-left">
            <CalendarIcon size={18} />
            <span>{ticket.datetime || '—'}</span>
          </span>
          <span className="mt-cab-trip-card__meta-right">
            <PersonIcon size={18} />
            <span>Pax: {ticket.pax ?? 1}</span>
          </span>
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

        {showDriver ? (
          <>
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
          </>
        ) : null}
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
            <TicketQrFlip flipDirection={qrFlipDirection}>
              <OtpQrCode value={pin} size={200} className="mt-qr mt-qr--cab-framed" />
            </TicketQrFlip>
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
          ) : cancelled ? (
            <span className="mt-cab-bottom-card__cancelled-label">Cancelled</span>
          ) : null}
        </div>
      </article>
    </div>
  )
}

function BusRouteTimeline({ from, to, fromEditable = false }) {
  return (
    <div className="mt-bus-route">
      <div className="mt-bus-route__stop mt-bus-route__stop--from">
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
      <div className="mt-bus-route__stop mt-bus-route__stop--to">
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

function MetroRouteTimeline({ from, to, fromRole, toRole, durationMin }) {
  const durationLabel = durationMin != null && durationMin > 0 ? `${durationMin} Min` : '—'
  return (
    <div className="mt-metro-route">
      <div className="mt-metro-route__duration">
        <ClockIcon className="mt-metro-route__clock" />
        <span>{durationLabel}</span>
      </div>
      <div className="mt-metro-route__content">
        <div className="mt-metro-route__stop mt-metro-route__stop--from">
          <div className="mt-metro-route__icon-col" aria-hidden="true">
            <span className="mt-metro-route__dot" />
            <span className="mt-metro-route__line" />
          </div>
          <div className="mt-metro-route__text">
            <strong className="mt-metro-route__name">{from}</strong>
            {fromRole ? <span className="mt-metro-route__label">{fromRole}</span> : null}
          </div>
        </div>
        <div className="mt-metro-route__stop mt-metro-route__stop--to">
          <div className="mt-metro-route__icon-col" aria-hidden="true">
            <span className="mt-metro-route__sq" />
          </div>
          <div className="mt-metro-route__text">
            <strong className="mt-metro-route__name">{to}</strong>
            {toRole ? <span className="mt-metro-route__label">{toRole}</span> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetroQrPanel({ ticket, flipDirection }) {
  const ticketQr = String(ticket.ticketQr || '').trim()
  const isImageQr = ticketQr.startsWith('data:image')

  let qrNode
  if (isImageQr) {
    qrNode = (
      <img
        src={ticketQr}
        alt="Metro ticket QR code"
        className="mt-qr mt-qr--metro-framed mt-qr--image"
        width={179}
        height={179}
      />
    )
  } else if (ticketQr) {
    qrNode = <OtpQrCode value={ticketQr} size={179} className="mt-qr mt-qr--metro-framed" />
  } else if (ticket.qrPayload) {
    qrNode = <QrCode payload={ticket.qrPayload} size={179} className="mt-qr mt-qr--metro-framed" />
  } else {
    qrNode = <div className="mt-metro-qr-card__placeholder">QR will appear once confirmed</div>
  }

  return (
    <article className="mt-metro-qr-card">
      <div className="mt-metro-qr-card__top">
        <div className="mt-metro-validity">
          <span className="mt-metro-validity__label">Valid till</span>
          <strong className="mt-metro-validity__value">{ticket.validTill || '—'}</strong>
        </div>
        <img className="mt-metro-qr-card__emblem" src={hyderabadMetroLogo} alt="Hyderabad Metro Rail" draggable={false} />
      </div>

      <div className="mt-metro-qr-card__divider" role="presentation" />

      <TicketQrFlip flipDirection={flipDirection}>{qrNode}</TicketQrFlip>

      <div className="mt-metro-info">
        <InfoIcon size={24} className="mt-metro-info__icon" />
        <p>{ticket.qrHint}</p>
      </div>
    </article>
  )
}

function MetroTicket({ ticket, onDropService, qrFlipDirection }) {
  const showFare = ticket.fareInr != null && Number(ticket.fareInr) > 0
  const platformLabel =
    ticket.platformNo != null && ticket.platformNo !== '' ? ticket.platformNo : '—'

  return (
    <div className="mt-ticket mt-ticket--metro">
      <article className="mt-metro-card">
        <header className="mt-metro-card__banner">
          <span className="mt-metro-card__ref">Ref ID: {ticket.refId}</span>
          {showFare ? <strong className="mt-metro-card__fare">₹{ticket.fareInr}</strong> : null}
        </header>

        <div className="mt-metro-card__body">
          <div className="mt-metro-meta">
            <span className="mt-metro-meta__left">
              <CalendarIcon size={18} />
              <span>{ticket.datetime || '—'}</span>
            </span>
            <span className="mt-metro-meta__right">
              <PersonIcon size={18} />
              <span>Pax: {ticket.pax ?? 1}</span>
            </span>
          </div>

          <div className="mt-metro-platform">
            <span className="mt-metro-platform__label">
              <img className="mt-metro-platform__icon" src={metroTabIcon} alt="" draggable={false} />
              Platform No: {platformLabel}
            </span>
            {ticket.tripType ? <span className="mt-metro-oneway">{ticket.tripType}</span> : null}
          </div>

          <MetroRouteTimeline
            from={ticket.from}
            to={ticket.to}
            fromRole={ticket.fromRole}
            toRole={ticket.toRole}
            durationMin={ticket.durationMin}
          />
        </div>
      </article>

      <MetroQrPanel ticket={ticket} flipDirection={qrFlipDirection} />

      <button type="button" className="mt-bus-drop" onClick={() => onDropService?.(ticket)}>
        Drop Service
      </button>
    </div>
  )
}

function formatCountdown(totalSeconds) {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) {
    return { hrs: '--', mns: '--', secs: '--' }
  }
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
        <div className="mt-countdown__row-item">
          <strong>{clock.hrs}</strong>
          <small>HRS</small>
        </div>
        <CountdownDotSep />
        <div className="mt-countdown__row-item">
          <strong>{clock.mns}</strong>
          <small>MNS</small>
        </div>
        <CountdownDotSep />
        <div className="mt-countdown__row-item">
          <strong>{clock.secs}</strong>
          <small>SECS</small>
        </div>
      </div>
    </div>
  )
}

function BusTicket({ ticket, onDropService, qrFlipDirection }) {
  const hasLiveQr = Boolean(ticket.bookingReferenceNumber)
  const [remaining, setRemaining] = useState(() =>
    hasLiveQr ? null : ticket.validSeconds ?? 0,
  )
  const [qrKey, setQrKey] = useState(0)
  const [qrFailed, setQrFailed] = useState(false)
  const expired = remaining != null && remaining <= 0
  const unusable = expired || qrFailed

  useEffect(() => {
    if (remaining == null) return undefined
    const id = window.setInterval(() => {
      setRemaining((n) => (n > 0 ? n - 1 : 0))
    }, 1000)
    return () => window.clearInterval(id)
  }, [remaining == null])

  const handleValidUntil = useCallback((validUntil) => {
    const seconds = secondsUntilValidUntil(validUntil)
    if (seconds != null) setRemaining(seconds)
  }, [])

  const handleQrState = useCallback(({ status, error, consumed, expired: qrExpired }) => {
    if (consumed || qrExpired) {
      setRemaining(0)
      setQrFailed(false)
      return
    }
    setQrFailed(status === 'error' && Boolean(error))
  }, [])

  const clock = formatCountdown(remaining)
  const pax = ticket.passengers
  const infoText = expired
    ? 'This ticket cannot be used now. Validity has expired or booking has been used.'
    : qrFailed
      ? 'Ticket QR could not be loaded. Tap Refresh QR to try again.'
      : ticket.instruction

  return (
    <div className={`mt-ticket mt-ticket--bus${unusable ? ' is-expired' : ''}`}>
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
          <div className={`mt-bus-validity${expired ? ' is-expired' : ''}`}>
            <span className="mt-bus-validity__label">
              {expired ? 'Ticket expired' : 'Ticket is Valid Till'}
            </span>
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
              expired={expired}
              onValidUntil={handleValidUntil}
              onQrState={handleQrState}
              wrapQr={(qr) => <TicketQrFlip flipDirection={qrFlipDirection}>{qr}</TicketQrFlip>}
            />
          ) : expired ? (
            <>
              <TicketQrFlip flipDirection={qrFlipDirection}>
                <ExpiredQrFrame
                  size={179}
                  className="mt-qr"
                />
              </TicketQrFlip>
            </>
          ) : (
            <>
              <TicketQrFlip flipDirection={qrFlipDirection}>
                <QrCode
                  payload={`${ticket.qrPayload}-${qrKey}`}
                  size={179}
                  className="mt-qr mt-qr--framed"
                />
              </TicketQrFlip>
              <div className="mt-bus-actions">
                <span className="mt-bus-valid">{ticket.status}</span>
                <button
                  type="button"
                  className="mt-bus-refresh mt-bus-refresh--outline"
                  onClick={() => setQrKey((n) => n + 1)}
                >
                  Refresh QR
                </button>
              </div>
            </>
          )}
        </div>

        <div className={`mt-bus-info${unusable ? ' is-expired' : ''}`}>
          <InfoIcon size={24} className="mt-bus-info__icon" />
          <p>{infoText}</p>
        </div>
      </article>

      <button type="button" className="mt-bus-drop" onClick={() => onDropService?.(ticket)}>
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

function CancelTripModal({
  open,
  reasonId,
  reasonNote = '',
  onReason,
  onReasonNote,
  onClose,
  onSkip,
  onConfirm,
  confirming = false,
  error = '',
}) {
  if (!open) return null

  const otherSelected = reasonId === 'other'
  const canConfirm =
    Boolean(reasonId) &&
    (!otherSelected || String(reasonNote || '').trim()) &&
    !confirming

  return (
    <div className="mt-cancel-modal" role="dialog" aria-modal="true" aria-labelledby="mt-cancel-title">
      <button
        type="button"
        className="mt-cancel-modal__backdrop"
        aria-label="Dismiss"
        onClick={onClose}
        disabled={confirming}
      />
      <div className="mt-cancel-modal__sheet">
        <div className="mt-cancel-modal__top">
          <button
            type="button"
            className="mt-cancel-modal__icon"
            onClick={onClose}
            aria-label="Close"
            disabled={confirming}
          >
            <CloseIcon size={18} />
          </button>
          <h2 id="mt-cancel-title">Cancel Trip?</h2>
          <button type="button" className="mt-cancel-modal__skip" onClick={onSkip} disabled={confirming}>
            Skip
          </button>
        </div>

        <p className="mt-cancel-modal__prompt">Why do you want to cancel?</p>

        <ul className="mt-cancel-modal__list">
          {CANCEL_REASONS.map((reason) => {
            const selected = reasonId === reason.id
            return (
              <li key={reason.id} className="mt-cancel-modal__item">
                <label className={`mt-cancel-modal__option${selected ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={reason.id}
                    checked={selected}
                    onChange={() => onReason(reason.id)}
                    disabled={confirming}
                  />
                  <span className="mt-cancel-modal__radio" aria-hidden="true" />
                  <span className="mt-cancel-modal__label">{reason.label}</span>
                </label>
                {reason.id === 'other' && selected ? (
                  <textarea
                    className="mt-cancel-modal__note"
                    value={reasonNote}
                    onChange={(event) => onReasonNote?.(event.target.value)}
                    placeholder="Please tell us more…"
                    rows={3}
                    maxLength={300}
                    aria-label="Other cancellation reason"
                    disabled={confirming}
                  />
                ) : null}
              </li>
            )
          })}
        </ul>

        {error ? (
          <p className="mt-cancel-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="mt-cancel-modal__cta"
          onClick={onConfirm}
          disabled={!canConfirm}
        >
          {confirming ? 'Cancelling…' : 'Cancel Ride'}
        </button>
      </div>
    </div>
  )
}

function renderTicket(ticket, { onCancel, onDropService, busKey, qrFlipDirection }) {
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

  if (ticket.bookingState === 'cancelled' && ticket.type !== 'cab' && ticket.type !== 'metro' && ticket.type !== 'bus') {
    return (
      <div className="mt-ticket mt-ticket--cancelled">
        <p className="mt-ticket-empty">{ticket.message || 'This booking was cancelled.'}</p>
      </div>
    )
  }

  switch (ticket.type) {
    case 'cab':
      return <CabTicket ticket={ticket} onCancel={onCancel} qrFlipDirection={qrFlipDirection} />
    case 'metro':
      return <MetroTicket ticket={ticket} onDropService={onDropService} qrFlipDirection={qrFlipDirection} />
    case 'bus':
      return <BusTicket key={busKey} ticket={ticket} onDropService={onDropService} qrFlipDirection={qrFlipDirection} />
    case 'other':
      return <OtherTicket ticket={ticket} />
    default:
      return <p className="mt-ticket-empty">Unsupported ticket type ({ticket.legType || ticket.type}).</p>
  }
}

function tabIndex(tabId) {
  return PRIMARY_TICKET_TABS.findIndex((tab) => tab.id === tabId)
}

function initialTabId(booking) {
  if (!booking) return 'metro'
  if (booking.defaultTab && isTabEnabled(booking, booking.defaultTab)) {
    return booking.defaultTab
  }
  return PRIMARY_TICKET_TABS.find((tab) => isTabEnabled(booking, tab.id))?.id ?? 'metro'
}

export function TicketsPage({
  booking,
  journey,
  trip,
  onBack,
  onCall,
  onCancelled,
  onDropService,
}) {
  const normalized = normalizeBooking(booking)
  const [tabId, setTabId] = useState(() => initialTabId(normalized))
  const [journeyIndex, setJourneyIndex] = useState(0)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reasonId, setReasonId] = useState('find-driver')
  const [reasonNote, setReasonNote] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [tabFlipDirection, setTabFlipDirection] = useState(null)
  const [mapGuideOpen, setMapGuideOpen] = useState(false)
  const prevTabIdRef = useRef(tabId)
  const skipTabFlipRef = useRef(true)

  const mapGuideOptions = useMemo(
    () =>
      buildMapGuideOptions({
        journey,
        trip,
        booking: normalized,
        pgStatus: normalized?.pgStatus,
      }),
    [journey, trip, normalized],
  )

  const handleMapGuide = useCallback((next) => {
    setMapGuideOpen((open) => (typeof next === 'boolean' ? next : !open))
  }, [])

  const handleTabChange = useCallback((nextTabId) => {
    if (!skipTabFlipRef.current) {
      const prevIdx = tabIndex(prevTabIdRef.current)
      const nextIdx = tabIndex(nextTabId)
      if (prevIdx !== -1 && nextIdx !== -1 && prevIdx !== nextIdx) {
        setTabFlipDirection(nextIdx > prevIdx ? 'ltr' : 'rtl')
      }
    } else {
      skipTabFlipRef.current = false
    }
    prevTabIdRef.current = nextTabId
    setTabId(nextTabId)
  }, [])

  useEffect(() => {
    if (!tabFlipDirection) return undefined
    const timer = window.setTimeout(() => setTabFlipDirection(null), 620)
    return () => window.clearTimeout(timer)
  }, [tabFlipDirection])

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
    if (!normalized) return
    setTabId((current) => (isTabEnabled(normalized, current) ? current : initialTabId(normalized)))
  }, [normalized?.id, normalized?.defaultTab])

  if (!normalized) {
    return (
      <section className="mt-tickets">
        <TicketsHeader
          onBack={onBack}
          onCall={onCall}
          mapGuideOpen={mapGuideOpen}
          onMapGuide={handleMapGuide}
          mapGuideOptions={mapGuideOptions}
        />
        <ModeTabs activeId="bus" enabledById={{ metro: false, bus: false, cab: false, other: false }} onChange={() => {}} />
        <p className="mt-ticket-empty">No active booking found.</p>
      </section>
    )
  }

  const busKey = `${normalized.id}-${tabId}-${ticket?.id ?? journeyIndex}`
  const tabEnabled = isTabEnabled(normalized, tabId)

  return (
    <section className="mt-tickets">
      <TicketsHeader
        onBack={onBack}
        onCall={onCall}
        mapGuideOpen={mapGuideOpen}
        onMapGuide={handleMapGuide}
        mapGuideOptions={mapGuideOptions}
      />
      {normalized.isPolling ? (
        <p className="mt-tickets__polling" role="status">
          Confirming your bookings…
        </p>
      ) : null}
      <ModeTabs activeId={tabId} enabledById={enabledById} onChange={handleTabChange} />
      {showJourneyTabs ? (
        <JourneyTabs journeys={journeys} activeIndex={journeyIndex} onChange={setJourneyIndex} />
      ) : null}

      {ticket?.bookingState === 'cancelled' ? (
        <p className="mt-tickets__cancelled-banner" role="status">
          Ride cancelled
        </p>
      ) : null}

      <div className="mt-tickets__body" role="tabpanel">
        {tabEnabled
          ? renderTicket(ticket, {
              onCancel: () => setCancelOpen(true),
              onDropService,
              busKey,
              qrFlipDirection: tabFlipDirection,
            })
          : (
            <EmptyTabPanel tabLabel={activeTab?.label ?? 'ticket'} />
          )}
      </div>

      <CancelTripModal
        open={cancelOpen}
        reasonId={reasonId}
        reasonNote={reasonNote}
        onReason={(nextId) => {
          setReasonId(nextId)
          if (nextId !== 'other') setReasonNote('')
          setCancelError('')
        }}
        onReasonNote={setReasonNote}
        onClose={() => {
          if (cancelLoading) return
          setCancelOpen(false)
          setCancelError('')
        }}
        onSkip={() => {
          if (cancelLoading) return
          setCancelOpen(false)
          setCancelError('')
        }}
        confirming={cancelLoading}
        error={cancelError}
        onConfirm={async () => {
          if (cancelLoading) return
          const reason = CANCEL_REASONS.find((item) => item.id === reasonId)
          const note = reasonId === 'other' ? String(reasonNote || '').trim() : ''
          const payload = {
            orderId: normalized?.orderId || normalized?.id,
            legId: ticket?.legId,
            legType: ticket?.legType || ticket?.type,
            reasonId,
            reasonLabel: reason?.label || reasonId,
            reason: note || reason?.label || reasonId,
            reasonNote: note,
          }
          setCancelLoading(true)
          setCancelError('')
          try {
            await onCancelled?.(payload)
            setCancelOpen(false)
            setReasonNote('')
          } catch (error) {
            setCancelError(error?.message || 'Could not cancel this ride.')
          } finally {
            setCancelLoading(false)
          }
        }}
      />
    </section>
  )
}
