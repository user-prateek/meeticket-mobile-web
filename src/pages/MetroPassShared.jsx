import QRCode from 'react-qr-code'
import hmrlLogo from '../assets/metro-pass/hmrl-header.png'
import { BackIcon, ChevronIcon } from '../components/icons'
import { formatPassCardDate, idProofLabel, maskIdProof } from '../lib/metroPass'

export function MetroPassHeader({ title, subtitle, onBack }) {
  return (
    <header className="mt-metro-pass__header">
      <button type="button" className="mt-metro-pass__back" onClick={onBack} aria-label="Go back">
        <BackIcon size={22} />
      </button>
      <div className="mt-metro-pass__header-copy">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <img src={hmrlLogo} alt="Hyderabad Metro Rail" className="mt-metro-pass__hmrl" draggable={false} />
    </header>
  )
}

export function MetroPassCard({ pass }) {
  if (!pass) return null
  const idLine = `${idProofLabel(pass.idProofType).toUpperCase()} - ${maskIdProof(pass.idProofNumber)}`

  return (
    <article className="mt-mp-card" aria-label="Monthly metro pass">
      <p className="mt-mp-card__issuer">HYDERABAD METRO RAIL LIMITED: HMRL</p>
      <div className="mt-mp-card__row">
        <div className="mt-mp-card__ids">
          <strong className="mt-mp-card__number">{pass.passNumber}</strong>
          <span className="mt-mp-card__caption">MONTHLY PASS NUMBER</span>
        </div>
        <div className="mt-mp-card__media">
          {pass.photoUrl ? (
            <img src={pass.photoUrl} alt="" className="mt-mp-card__photo" draggable={false} />
          ) : (
            <span className="mt-mp-card__photo is-empty" aria-hidden="true" />
          )}
          <span className="mt-mp-card__mini-qr">
            {pass.passNumber ? (
              <QRCode value={pass.passNumber} size={52} bgColor="#ffffff" fgColor="#111111" level="M" />
            ) : null}
          </span>
        </div>
      </div>
      <p className="mt-mp-card__proof">{idLine}</p>
      <div className="mt-mp-card__footer">
        <div>
          <strong>{pass.fullName}</strong>
          <span>CARD HOLDER NAME</span>
        </div>
        <div>
          <strong>{formatPassCardDate(pass.validTill)}</strong>
          <span>VALID TILL</span>
        </div>
        <img src={hmrlLogo} alt="" className="mt-mp-card__badge" draggable={false} />
      </div>
    </article>
  )
}

export function MetroPassChevron({ open }) {
  return (
    <ChevronIcon
      size={14}
      className={`mt-metro-pass__chevron${open ? ' is-open' : ''}`}
    />
  )
}
