import { useLocation } from 'react-router-dom'
import { helplineNumber } from '../api/config'
import { AppLogo, BackIcon, ChevronIcon, PhoneIcon } from '../components/icons'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { GOTO_HOME_PATH } from '../lib/appContext'
import './MetroPage.css'

function MetroTicketGlyph() {
  return (
    <svg className="mt-metro-home__glyph" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M17 20.2c0-2.35 3.1-4.2 7-4.2s7 1.85 7 4.2V30H17V20.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <circle cx="20.2" cy="22.6" r="1.55" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <circle cx="27.8" cy="22.6" r="1.55" fill="none" stroke="currentColor" strokeWidth="1.35" />
      <path d="M17 30h14" stroke="currentColor" strokeWidth="1.65" />
      <path d="M19.2 33.2h2.2M26.6 33.2h2.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  )
}

function MetroPassGlyph() {
  return (
    <svg className="mt-metro-home__glyph" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21.25" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <rect
        x="13.5"
        y="17"
        width="21"
        height="14"
        rx="2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        d="M17.4 21.1c0-1.15 1.55-2 3.4-2s3.4.85 3.4 2V27H17.4v-5.9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <circle cx="19.1" cy="22.4" r="0.7" fill="currentColor" />
      <circle cx="22.5" cy="22.4" r="0.7" fill="currentColor" />
      <path d="M17.4 27h6.8" stroke="currentColor" strokeWidth="1.35" />
    </svg>
  )
}

const OPTIONS = [
  {
    id: 'ticket',
    title: 'Buy Metro Ticket',
    copy: "Book your metro ticket for today's journey",
    Glyph: MetroTicketGlyph,
  },
  {
    id: 'pass',
    title: 'Buy Metro Pass',
    copy: 'Purchase a pass for regular metro travel',
    Glyph: MetroPassGlyph,
  },
]

/**
 * /metro?from_lat&from_lon&to_lat&to_lon&from&to
 * Chooser: ticket → /metro/ticket. Pass → /metro/pass.
 */
export function MetroPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const telHref = helplineNumber ? `tel:${helplineNumber.replace(/[^\d+]/g, '')}` : undefined

  function goHome() {
    navigate(GOTO_HOME_PATH, { replace: true })
  }

  function choose(optionId) {
    if (optionId === 'pass') {
      navigate('/metro/pass')
      return
    }
    navigate({ pathname: '/metro/ticket', search: location.search })
  }

  return (
    <section className="mt-metro-home">
      <header className="mt-metro-home__header">
        <button type="button" className="mt-metro-home__icon-btn" onClick={goHome} aria-label="Go back">
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

      <div className="mt-metro-home__list">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="mt-metro-home__card"
            onClick={() => choose(option.id)}
          >
            <span className="mt-metro-home__icon">
              <option.Glyph />
            </span>
            <span className="mt-metro-home__copy">
              <strong>{option.title}</strong>
              <span>{option.copy}</span>
            </span>
            <ChevronIcon size={16} className="mt-metro-home__chevron" />
          </button>
        ))}
      </div>
    </section>
  )
}
