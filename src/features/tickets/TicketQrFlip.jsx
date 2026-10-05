/** 3D page-flip wrapper for ticket QR codes on tab switch. */
export function TicketQrFlip({ flipDirection, showScan = true, children }) {
  const flipClass = flipDirection ? `mt-ticket-qr-flip--${flipDirection}` : 'mt-ticket-qr-flip--settled'

  return (
    <div className={`mt-ticket-qr-flip ${flipClass}`}>
      <div className="mt-ticket-qr-flip__scene">
        <div className="mt-ticket-qr-flip__coin">
          <div className="mt-ticket-qr-flip__edge" aria-hidden="true" />
          <div className="mt-ticket-qr-flip__face">
            {children}
            {showScan ? <span className="mt-ticket-qr-flip__scan" aria-hidden="true" /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
