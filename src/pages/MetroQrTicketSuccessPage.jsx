import { Navigate } from 'react-router-dom'
import hyderabadMetroLogo from '../assets/brands/hyderabad-metro.png'
import metroTabIcon from '../assets/icons/metro.png'
import { helplineNumber } from '../api/config'
import {
  AppLogo,
  BackIcon,
  CalendarIcon,
  ClockIcon,
  InfoIcon,
  PersonIcon,
  PhoneIcon,
} from '../components/icons'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { loadMetroQrTicket } from '../lib/metroQrTicket'
import { OtpQrCode } from '../features/tickets/OtpQrCode'
import { TicketQrFlip } from '../features/tickets/TicketQrFlip'
import '../features/tickets/tickets.tokens.css'
import '../features/tickets/TicketsPage.css'
import '../features/tickets/TicketsPage.metro.css'
import '../features/tickets/TicketsPage.qr-flip.css'
import './MetroPage.css'
import './MetroQrTicket.css'

export function MetroQrTicketSuccessPage() {
  const navigate = useAppNavigate()
  const ticket = loadMetroQrTicket()
  const telHref = helplineNumber ? `tel:${helplineNumber.replace(/[^\d+]/g, '')}` : undefined

  if (!ticket) return <Navigate to="/metro/ticket" replace />

  const showFare = ticket.fareInr != null && Number(ticket.fareInr) > 0
  const platformLabel = ticket.platformNo || '—'
  const durationLabel =
    ticket.durationMin != null && Number(ticket.durationMin) > 0 ? `${ticket.durationMin} Min` : '—'

  return (
    <section className="mt-mqt-success">
      <header className="mt-metro-home__header">
        <button
          type="button"
          className="mt-metro-home__icon-btn"
          onClick={() => navigate('/metro')}
          aria-label="Go back"
        >
          <BackIcon size={28} />
        </button>
        <AppLogo width={60} height={58} className="mt-metro-home__logo" />
        {telHref ? (
          <a className="mt-metro-home__icon-btn" href={telHref} aria-label="Call support">
            <PhoneIcon size={20} />
          </a>
        ) : (
          <button type="button" className="mt-metro-home__icon-btn" aria-label="Call support">
            <PhoneIcon size={20} />
          </button>
        )}
      </header>

      <div className="mt-mqt-success__body">
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
                  <span>{ticket.datetime}</span>
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
                      <strong className="mt-metro-route__name">{ticket.from} Metro Station</strong>
                      <span className="mt-metro-route__label">{ticket.fromRole}</span>
                    </div>
                  </div>
                  <div className="mt-metro-route__stop mt-metro-route__stop--to">
                    <div className="mt-metro-route__icon-col" aria-hidden="true">
                      <span className="mt-metro-route__sq" />
                    </div>
                    <div className="mt-metro-route__text">
                      <strong className="mt-metro-route__name">{ticket.to} Metro Station</strong>
                      <span className="mt-metro-route__label">{ticket.toRole}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className="mt-metro-qr-card">
            <div className="mt-metro-qr-card__top">
              <div className="mt-metro-validity">
                <span className="mt-metro-validity__label">Valid till</span>
                <strong className="mt-metro-validity__value">{ticket.validTill}</strong>
              </div>
              <img
                className="mt-metro-qr-card__emblem"
                src={hyderabadMetroLogo}
                alt="Hyderabad Metro Rail"
                draggable={false}
              />
            </div>
            <div className="mt-metro-qr-card__divider" role="presentation" />
            <TicketQrFlip>
              <OtpQrCode value={ticket.qrPayload} size={179} className="mt-qr mt-qr--metro-framed" />
            </TicketQrFlip>
            <div className="mt-metro-info">
              <InfoIcon size={24} className="mt-metro-info__icon" />
              <p>{ticket.qrHint}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
