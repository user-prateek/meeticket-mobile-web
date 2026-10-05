import { useMemo, useRef, useState } from 'react'
import monthlyPassBanner from '../assets/metro-pass/monthly-pass-banner.png'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useAppSession } from '../hooks/useAppSession'
import {
  ID_PROOF_TYPES,
  METRO_PASS_PRICE_INR,
  digitsOnly,
  idProofLabel,
  issueMetroPass,
} from '../lib/metroPass'
import { MetroPassChevron, MetroPassHeader } from './MetroPassShared'
import './MetroPass.css'

const PHOTO_MAX_BYTES = 2 * 1024 * 1024
const PHOTO_ACCEPT = 'image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf'

function readPhotoUrl(file) {
  return new Promise((resolve) => {
    if (!file?.type?.startsWith('image/')) {
      resolve('')
      return
    }
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)
    image.onload = () => {
      const size = 96
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      const scale = Math.max(size / image.width, size / image.height)
      const dw = image.width * scale
      const dh = image.height * scale
      ctx.drawImage(image, (size - dw) / 2, (size - dh) / 2, dw, dh)
      URL.revokeObjectURL(objectUrl)
      resolve(canvas.toDataURL('image/jpeg', 0.72))
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve('')
    }
    image.src = objectUrl
  })
}

function OutlineField({ label, children }) {
  return (
    <label className="mt-mp-field">
      <span className="mt-mp-field__label">{label}</span>
      {children}
    </label>
  )
}

export function MetroPassPage() {
  const navigate = useAppNavigate()
  const { user } = useAppSession()
  const photoRef = useRef(null)

  const [fullName, setFullName] = useState(user?.name || '')
  const [mobile, setMobile] = useState(digitsOnly(user?.mobile).slice(-10))
  const [idProofType, setIdProofType] = useState('aadhar')
  const [idProofNumber, setIdProofNumber] = useState('')
  const [idMenuOpen, setIdMenuOpen] = useState(false)
  const [photoName, setPhotoName] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  const selectedId = useMemo(
    () => ID_PROOF_TYPES.find((item) => item.id === idProofType) || ID_PROOF_TYPES[0],
    [idProofType],
  )

  const canPay =
    fullName.trim().length > 1 &&
    digitsOnly(mobile).length === 10 &&
    Boolean(idProofType) &&
    idProofNumber.trim().length >= 4 &&
    Boolean(photoName) &&
    accepted

  async function onPhotoChange(event) {
    const file = event.target.files?.[0]
    setPhotoError('')
    if (!file) {
      setPhotoName('')
      setPhotoUrl('')
      return
    }
    const okType =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      file.type === 'application/pdf' ||
      /\.(jpe?g|png|pdf)$/i.test(file.name)
    if (!okType) {
      setPhotoName('')
      setPhotoUrl('')
      setPhotoError('Use JPG, PNG or PDF.')
      return
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoName('')
      setPhotoUrl('')
      setPhotoError('File must be 2 MB or smaller.')
      return
    }
    setPhotoName(file.name)
    setPhotoUrl(await readPhotoUrl(file))
  }

  function submit(event) {
    event.preventDefault()
    if (!canPay) {
      setError('Fill all fields, upload a photo, and accept the terms to continue.')
      return
    }
    issueMetroPass({
      fullName,
      mobile,
      idProofType,
      idProofNumber,
      photoName,
      photoUrl,
    })
    navigate('/metro/pass/details', { replace: true })
  }

  return (
    <section className="mt-metro-pass">
      <MetroPassHeader title="Buy Metro Pass" onBack={() => navigate('/metro')} />

      <form className="mt-metro-pass__form" onSubmit={submit}>
        <div className="mt-metro-pass__body">
          <img
            className="mt-metro-pass__banner"
            src={monthlyPassBanner}
            alt="Monthly Pass for metro travellers"
            draggable={false}
          />

          <OutlineField label="Full Name">
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
            />
          </OutlineField>

          <div className="mt-metro-pass__split">
            <OutlineField label="ISD">
              <input value="+91" readOnly aria-readonly="true" />
            </OutlineField>
            <OutlineField label="Mobile Number">
              <input
                value={mobile}
                onChange={(event) => setMobile(digitsOnly(event.target.value).slice(0, 10))}
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
              />
            </OutlineField>
          </div>

          <div className={`mt-mp-field${idMenuOpen ? ' is-open' : ''}`}>
            <span className="mt-mp-field__label">ID Proof Type</span>
            <button
              type="button"
              className="mt-mp-field__select"
              aria-haspopup="listbox"
              aria-expanded={idMenuOpen}
              onClick={() => setIdMenuOpen((open) => !open)}
            >
              {selectedId.label}
              <MetroPassChevron open={idMenuOpen} />
            </button>
            {idMenuOpen ? (
              <ul className="mt-mp-menu" role="listbox">
                {ID_PROOF_TYPES.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.id === idProofType}
                      className={item.id === idProofType ? 'is-active' : ''}
                      onClick={() => {
                        setIdProofType(item.id)
                        setIdMenuOpen(false)
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <OutlineField label="ID Proof Number">
            <input
              value={idProofNumber}
              onChange={(event) => setIdProofNumber(event.target.value)}
              placeholder={`${idProofLabel(idProofType)} number`}
              autoCapitalize="characters"
            />
          </OutlineField>

          <div className="mt-mp-photo">
            <input
              ref={photoRef}
              className="mt-metro-pass__file"
              type="file"
              accept={PHOTO_ACCEPT}
              onChange={onPhotoChange}
            />
            <button type="button" className="mt-mp-photo__btn" onClick={() => photoRef.current?.click()}>
              <span className="mt-mp-photo__cam" aria-hidden="true">
                <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
                  <path
                    d="M8.2 2.2 7.3 3.6H4.2A2.2 2.2 0 0 0 2 5.8v9a2.2 2.2 0 0 0 2.2 2.2h13.6A2.2 2.2 0 0 0 20 14.8v-9a2.2 2.2 0 0 0-2.2-2.2h-3.1l-.9-1.4H8.2Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <circle cx="11" cy="10.2" r="3.2" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </span>
              <span className="mt-mp-photo__copy">
                <strong>{photoName || 'Capture Selfie / Upload Photo'}</strong>
                <small>JPG, PNG, PDF (Max 2 MB)</small>
              </span>
              <span className="mt-mp-photo__cloud" aria-hidden="true">
                <svg width="22" height="18" viewBox="0 0 22 18" fill="none">
                  <path
                    d="M15.4 14.2H6.6A4.1 4.1 0 0 1 6.4 6.1 5.2 5.2 0 0 1 16 6.8a3.6 3.6 0 0 1-.6 7.4Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                  <path d="M11 12.2V7.4M11 7.4 8.8 9.5M11 7.4l2.2 2.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </button>
            {photoError ? <p className="mt-metro-pass__hint is-error">{photoError}</p> : null}
          </div>

          {error ? <p className="mt-metro-pass__hint is-error">{error}</p> : null}
        </div>

        <div className="mt-metro-pass__bar">
          <label className="mt-mp-accept">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            <span>I Accept the Terms &amp; Conditions</span>
          </label>
          <div className="mt-mp-payrow">
            <div className="mt-mp-price">
              <span>Total Price</span>
              <strong>₹{METRO_PASS_PRICE_INR}/-</strong>
            </div>
            <button type="submit" className="mt-metro-pass__cta mt-metro-pass__cta--split" disabled={!canPay}>
              Proceed To Pay
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
