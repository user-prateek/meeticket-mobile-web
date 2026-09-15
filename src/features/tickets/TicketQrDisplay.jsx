import { useEffect, useMemo } from 'react'
import { CheckIcon, CloseIcon, RefreshIcon } from '../../components/icons'
import { secondsUntilValidUntil } from '../../constants/tickets'
import { useBookingQr } from '../../hooks/useBookingQr'
import expiredQrDummy from '../../assets/tickets/expired-qr-dummy.png'
import { QrCode } from './QrCode'

function StatusQrFrame({ size = 179, className = '', variant = 'expired' }) {
  const validated = variant === 'validated'
  return (
    <div
      className={`mt-qr-expired${validated ? ' is-validated' : ''} ${className}`.trim()}
      style={{ width: size, height: size }}
      role="img"
      aria-label={validated ? 'Validated ticket QR code' : 'Expired ticket QR code'}
    >
      <img
        src={expiredQrDummy}
        alt=""
        className="mt-qr-expired__art"
        width={size}
        height={size}
        draggable={false}
      />
      <span className="mt-qr-expired__veil" aria-hidden="true" />
      <span className={`mt-qr-expired-badge${validated ? ' is-validated' : ''}`}>
        <span className="mt-qr-expired-badge__icon" aria-hidden="true">
          {validated ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.6 6.2 5 8.6 9.4 3.6"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M3.2 3.2 8.8 8.8M8.8 3.2 3.2 8.8"
                stroke="#fff"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          )}
        </span>
        {validated ? 'VALIDATED' : 'EXPIRED'}
      </span>
    </div>
  )
}

function ExpiredQrFrame(props) {
  return <StatusQrFrame {...props} variant="expired" />
}

function ValidatedQrFrame(props) {
  return <StatusQrFrame {...props} variant="validated" />
}

export function TicketQrDisplay({
  bookingReferenceNumber,
  fallbackPayload,
  size = 180,
  className = 'mt-qr',
  refreshable = false,
  expired = false,
  onValidUntil,
  onQrState,
  /** Wrap only the QR graphic (e.g. TicketQrFlip). Actions stay outside the wrapper. */
  wrapQr,
}) {
  const { status, qrImage, validUntil, error, consumed, refetch } = useBookingQr(
    bookingReferenceNumber,
  )

  const secondsLeft = useMemo(
    () => (validUntil ? secondsUntilValidUntil(validUntil) : null),
    [validUntil],
  )
  const qrConsumed = status === 'consumed' || consumed
  const isValidated = qrConsumed
  const isExpired =
    !isValidated && (expired || (secondsLeft != null && secondsLeft <= 0))
  const qrUnavailable = status === 'error' && !qrImage && !isExpired && !isValidated

  useEffect(() => {
    if (validUntil) onValidUntil?.(validUntil)
  }, [validUntil, onValidUntil])

  useEffect(() => {
    onQrState?.({
      status,
      error,
      validUntil,
      expired: isExpired,
      consumed: qrConsumed,
    })
  }, [status, error, validUntil, isExpired, qrConsumed, onQrState])

  let qrNode

  if (bookingReferenceNumber && isValidated) {
    qrNode = <ValidatedQrFrame size={size} className={className} />
  } else if (bookingReferenceNumber && isExpired) {
    qrNode = <ExpiredQrFrame size={size} className={className} />
  } else if (bookingReferenceNumber && status === 'loading' && !qrImage) {
    qrNode = (
      <div className="mt-qr mt-qr--loading" style={{ width: size, height: size }} role="status">
        Loading QR…
      </div>
    )
  } else if (bookingReferenceNumber && qrImage) {
    qrNode = (
      <img
        src={qrImage}
        alt="Ticket QR code"
        className={`${className} mt-qr--image mt-qr--framed`}
        width={size}
        height={size}
      />
    )
  } else if (bookingReferenceNumber && qrUnavailable) {
    qrNode = (
      <div className="mt-qr mt-qr--error">
        <p>{error || 'Could not load QR code'}</p>
        <button type="button" className="mt-bus-refresh mt-bus-refresh--outline" onClick={refetch}>
          Try again
        </button>
      </div>
    )
  } else {
    qrNode = (
      <QrCode payload={fallbackPayload} size={size} className={`${className} mt-qr--framed`} />
    )
  }

  // Expired / validated: no Valid / Refresh row under the QR.
  const showActions = refreshable && bookingReferenceNumber && !isExpired && !isValidated

  let statusEl = (
    <span className="mt-bus-valid">
      <CheckIcon size={20} />
      Valid
    </span>
  )
  if (qrUnavailable) {
    statusEl = (
      <span className="mt-bus-valid is-expired" role="status">
        <CloseIcon size={18} />
        Unavailable
      </span>
    )
  }

  const actionsEl = showActions ? (
    <div className="mt-bus-actions">
      {statusEl}
      <button
        type="button"
        className="mt-bus-refresh mt-bus-refresh--outline"
        onClick={refetch}
        disabled={status === 'loading'}
      >
        <RefreshIcon size={20} />
        {status === 'loading' ? 'Refreshing…' : 'Refresh QR'}
      </button>
    </div>
  ) : null

  if (wrapQr) {
    return (
      <>
        {wrapQr(qrNode)}
        {actionsEl}
      </>
    )
  }

  if (!showActions) {
    return qrNode
  }

  return (
    <>
      {qrNode}
      {actionsEl}
    </>
  )
}

export { ExpiredQrFrame, ValidatedQrFrame }
