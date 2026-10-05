import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import singleTravellerArt from '../assets/metro-pass/single-traveller.png'
import { CheckIcon } from '../components/icons'
import { HYDERABAD_METRO_STATIONS, matchMetroStation } from '../constants/metroStations'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useAppSession } from '../hooks/useAppSession'
import {
  formatPassDateLong,
  loadMetroPass,
  digitsOnly,
} from '../lib/metroPass'
import {
  METRO_QR_ONEWAY_INR,
  METRO_QR_RETURN_INR,
  issueMetroQrTicket,
  normalizeOtp,
} from '../lib/metroQrTicket'
import { parseTripQuery } from '../lib/tripQuery'
import { MetroPassCard, MetroPassChevron, MetroPassHeader } from './MetroPassShared'
import './MetroPass.css'
import './MetroQrTicket.css'

function StationField({ label, value, open, onToggle, onPick }) {
  return (
    <div className={`mt-mp-field${open ? ' is-open' : ''}`}>
      <span className="mt-mp-field__label">{label}</span>
      <button
        type="button"
        className="mt-mp-field__select"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
      >
        {value || 'Select station'}
        <MetroPassChevron open={open} />
      </button>
      {open ? (
        <ul className="mt-mp-menu mt-mp-menu--scroll" role="listbox">
          {HYDERABAD_METRO_STATIONS.map((station) => (
            <li key={station}>
              <button
                type="button"
                role="option"
                aria-selected={station === value}
                className={station === value ? 'is-active' : ''}
                onClick={() => onPick(station)}
              >
                {station}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function TypeCard({ selected, title, fare, icon, onSelect }) {
  return (
    <button
      type="button"
      className={`mt-mqt-type${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
    >
      <span className="mt-mqt-type__icon" aria-hidden="true">
        {icon}
      </span>
      <span className={`mt-mqt-type__radio${selected ? ' is-on' : ''}`} />
      <strong>{title}</strong>
      <em>₹{fare}</em>
    </button>
  )
}

export function MetroQrTicketPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const { user } = useAppSession()
  const trip = useMemo(() => parseTripQuery(location.search), [location.search])
  const storedPass = useMemo(() => loadMetroPass(), [])

  const [from, setFrom] = useState(
    () => matchMetroStation(trip.fromPlace) || 'Ameerpet',
  )
  const [to, setTo] = useState(() => matchMetroStation(trip.toPlace) || 'Tarnaka')
  const [openField, setOpenField] = useState(null)
  const [count, setCount] = useState(1)
  const [ticketType, setTicketType] = useState('oneway')
  const [hasPass, setHasPass] = useState(false)
  const [mobile, setMobile] = useState(digitsOnly(user?.mobile || storedPass?.mobile).slice(-10))
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [validated, setValidated] = useState(false)
  const [singleAlert, setSingleAlert] = useState(false)

  const pass = storedPass
  const canGenerate = Boolean(from && to && from !== to && (!hasPass || validated))

  function closeMenus() {
    setOpenField(null)
  }

  function trySetCount(next) {
    const value = Math.min(6, Math.max(1, next))
    if (hasPass && value > 1) {
      setSingleAlert(true)
      return
    }
    setCount(value)
  }

  function togglePass(checked) {
    if (checked && count > 1) {
      setHasPass(true)
      setSingleAlert(true)
      return
    }
    setHasPass(checked)
    if (!checked) {
      setOtpSent(false)
      setValidated(false)
      setOtp('')
    }
  }

  function onSingleOk() {
    setSingleAlert(false)
    setCount(1)
    setHasPass(true)
  }

  function sendOtp() {
    if (digitsOnly(mobile).length !== 10) return
    setOtpSent(true)
  }

  function validateOtp() {
    if (normalizeOtp(otp).length !== 4) return
    setValidated(true)
  }

  function submit() {
    if (!canGenerate) return
    issueMetroQrTicket({
      from,
      to,
      ticketType,
      pax: hasPass ? 1 : count,
      usedPass: hasPass && validated,
    })
    navigate('/metro/ticket/success', { replace: true })
  }

  const footerLabel = hasPass ? 'Generate Ticket' : 'Proceed to Pay'

  return (
    <section className="mt-metro-pass">
      <MetroPassHeader title="Buy Metro QR Ticket" onBack={() => navigate('/metro')} />

      <div className="mt-metro-pass__form">
        <div className="mt-metro-pass__body" onClick={closeMenus}>
          <div onClick={(event) => event.stopPropagation()}>
            <StationField
              label="From Metro Station"
              value={from}
              open={openField === 'from'}
              onToggle={() => setOpenField(openField === 'from' ? null : 'from')}
              onPick={(station) => {
                setFrom(station)
                setOpenField(null)
              }}
            />
            <StationField
              label="To Metro Station"
              value={to}
              open={openField === 'to'}
              onToggle={() => setOpenField(openField === 'to' ? null : 'to')}
              onPick={(station) => {
                setTo(station)
                setOpenField(null)
              }}
            />
          </div>

          <div className="mt-mqt-count">
            <div>
              <strong>Tickets</strong>
              <span>Select No of Tickets</span>
            </div>
            <div className="mt-mqt-stepper">
              <button type="button" aria-label="Fewer tickets" onClick={() => trySetCount(count - 1)}>
                −
              </button>
              <em>{count}</em>
              <button type="button" aria-label="More tickets" onClick={() => trySetCount(count + 1)}>
                +
              </button>
            </div>
          </div>

          <p className="mt-mqt-label">Ticket Type</p>
          <div className="mt-mqt-types">
            <TypeCard
              selected={ticketType === 'oneway'}
              title="Oneway"
              fare={METRO_QR_ONEWAY_INR}
              onSelect={() => setTicketType('oneway')}
              icon={
                <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="5.5" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="10.5" cy="8" r="1.2" fill="currentColor" />
                  <path d="M16 8h5M18.5 5.5 21 8l-2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
            <TypeCard
              selected={ticketType === 'return'}
              title="With Return"
              fare={METRO_QR_RETURN_INR}
              onSelect={() => setTicketType('return')}
              icon={
                <svg width="22" height="16" viewBox="0 0 22 16" fill="none">
                  <rect x="1" y="3" width="13" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16.5 5.2 20 8l-3.5 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
            />
          </div>

          <div className="mt-mqt-pass">
            <label className="mt-mqt-pass__check">
              <input
                type="checkbox"
                checked={hasPass}
                onChange={(event) => togglePass(event.target.checked)}
              />
              <span>I have Monthly Pass</span>
            </label>

            {hasPass && count === 1 ? (
              <div className="mt-mqt-pass__body">
                <div className="mt-metro-pass__split">
                  <label className="mt-mp-field">
                    <span className="mt-mp-field__label">ISD</span>
                    <input value="+91" readOnly />
                  </label>
                  <label className="mt-mp-field">
                    <span className="mt-mp-field__label">Enter Mobile No</span>
                    <input
                      value={mobile}
                      onChange={(event) => {
                        setMobile(digitsOnly(event.target.value).slice(0, 10))
                        setValidated(false)
                      }}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="mt-metro-pass__cta"
                  disabled={otpSent || digitsOnly(mobile).length !== 10}
                  onClick={sendOtp}
                >
                  Validate with OTP
                </button>

                {otpSent ? (
                  <>
                    <label className="mt-mp-field">
                      <span className="mt-mp-field__label">Enter OTP</span>
                      <input
                        value={otp}
                        onChange={(event) => setOtp(normalizeOtp(event.target.value))}
                        inputMode="numeric"
                        maxLength={4}
                        disabled={validated}
                      />
                    </label>
                    <button
                      type="button"
                      className="mt-metro-pass__cta"
                      disabled={validated || otp.length !== 4}
                      onClick={validateOtp}
                    >
                      Validate
                    </button>
                  </>
                ) : null}

                {validated ? (
                  <>
                    <div className="mt-mqt-pass__status">
                      <div>
                        <span>Pass No</span>
                        <strong>{pass?.passNumber || 'APST789456'}</strong>
                      </div>
                      <div>
                        <span>Valid Till</span>
                        <strong>{pass ? formatPassDateLong(pass.validTill) : '—'}</strong>
                      </div>
                      <span className="mt-mqt-active">
                        <CheckIcon size={14} />
                        Active
                      </span>
                    </div>
                    {pass ? <MetroPassCard pass={pass} /> : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-metro-pass__bar">
          <button type="button" className="mt-metro-pass__cta" disabled={!canGenerate} onClick={submit}>
            {footerLabel}
          </button>
        </div>
      </div>

      {singleAlert ? (
        <div className="mt-mqt-modal" role="presentation" onClick={onSingleOk}>
          <div
            className="mt-mqt-modal__card"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mt-mqt-single-msg"
            onClick={(event) => event.stopPropagation()}
          >
            <img src={singleTravellerArt} alt="" draggable={false} />
            <p id="mt-mqt-single-msg">Metro Pass is for a single traveller only.</p>
            <button type="button" className="mt-metro-pass__cta" onClick={onSingleOk}>
              Ok
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
