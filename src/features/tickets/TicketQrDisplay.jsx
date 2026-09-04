import { useEffect } from 'react'
import { CheckIcon, CloseIcon, RefreshIcon } from '../../components/icons'
import { useBookingQr } from '../../hooks/useBookingQr'
import { QrCode } from './QrCode'

export function TicketQrDisplay({
  bookingReferenceNumber,
  fallbackPayload,
  size = 180,
  className = 'mt-qr',
  refreshable = false,
  expired = false,
  onValidUntil,
  /** Wrap only the QR graphic (e.g. TicketQrFlip). Actions stay outside the wrapper. */
  wrapQr,
}) {
  const { status, qrImage, validUntil, error, refetch } = useBookingQr(bookingReferenceNumber)

  useEffect(() => {
    if (validUntil) onValidUntil?.(validUntil)
  }, [validUntil, onValidUntil])

  let qrNode

  if (bookingReferenceNumber && status === 'loading' && !qrImage) {
    qrNode = (
      <div className="mt-qr mt-qr--loading" style={{ width: size, height: size }} role="status">
        Loading QR…
      </div>
    )
  } else if (bookingReferenceNumber && qrImage) {
    qrNode = (
      <img
        src={qrImage}
        alt={expired ? 'Expired ticket QR code' : 'Ticket QR code'}
        className={`${className} mt-qr--image mt-qr--framed${expired ? ' is-expired' : ''}`}
        width={size}
        height={size}
      />
    )
  } else if (bookingReferenceNumber && status === 'error' && !qrImage) {
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
      <QrCode
        payload={fallbackPayload}
        size={size}
        className={`${className} mt-qr--framed${expired ? ' is-expired' : ''}`}
      />
    )
  }

  const actionsEl =
    refreshable && bookingReferenceNumber ? (
      <div className="mt-bus-actions">
        {expired ? (
          <span className="mt-bus-valid is-expired" role="status">
            <CloseIcon size={18} />
            Expired
          </span>
        ) : (
          <span className="mt-bus-valid">
            <CheckIcon size={20} />
            Valid
          </span>
        )}
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

  if (!refreshable || !bookingReferenceNumber) {
    return qrNode
  }

  return (
    <>
      {qrNode}
      {actionsEl}
    </>
  )
}
