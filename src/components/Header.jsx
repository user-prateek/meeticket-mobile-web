import { BackIcon } from './icons'
import './Header.css'

export function Header({ title, subtitle, onBack }) {
  return (
    <header className="mt-header">
      <button
        type="button"
        className="mt-header__back"
        onClick={onBack}
        aria-label="Go back"
        disabled={!onBack}
      >
        <BackIcon />
      </button>
      <div className="mt-header__copy">
        <h1 className="mt-header__title">{title}</h1>
        {subtitle ? <p className="mt-header__subtitle">{subtitle}</p> : null}
      </div>
    </header>
  )
}
