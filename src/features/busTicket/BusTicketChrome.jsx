import meeticketLogo from '../../assets/brands/meeticket.png'
import { helplineNumber } from '../../api/config'
import { BackIcon, MenuIcon, PhoneIcon } from './icons'

export function BusTicketHeader({ variant = 'back', onBack }) {
  const tel = helplineNumber ? `tel:${helplineNumber.replace(/[^\d+]/g, '')}` : undefined
  return (
    <header className="bt-header">
      {variant === 'menu' ? (
        <span className="bt-header__icon" aria-hidden="true">
          <MenuIcon />
        </span>
      ) : (
        <button type="button" className="bt-header__icon" onClick={onBack} aria-label="Go back">
          <BackIcon />
        </button>
      )}
      <img className="bt-header__logo" src={meeticketLogo} alt="MeeTicket" />
      {tel ? (
        <a className="bt-header__icon" href={tel} aria-label="Call support">
          <PhoneIcon />
        </a>
      ) : (
        <span className="bt-header__icon" aria-hidden="true">
          <PhoneIcon />
        </span>
      )}
    </header>
  )
}

export function BookBar({ label, disabled, onClick }) {
  return (
    <button type="button" className="bt-book" disabled={disabled} onClick={onClick}>
      {label}
    </button>
  )
}
