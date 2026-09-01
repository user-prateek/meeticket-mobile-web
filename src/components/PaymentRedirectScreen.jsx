import meeticketLogo from '../assets/brands/meeticket.png'
import './PaymentRedirectScreen.css'

export function PaymentRedirectScreen({
  title = 'Payment received',
  message = 'Redirecting you to Mee Ticket…',
  orderId,
  compact = false,
}) {
  return (
    <div className={`mt-pay-redirect${compact ? ' mt-pay-redirect--compact' : ''}`} role="status" aria-live="polite">
      <div className="mt-pay-redirect__card">
        <img className="mt-pay-redirect__logo" src={meeticketLogo} alt="" width={56} height={54} draggable={false} />
        <div className="mt-pay-redirect__spinner" aria-hidden="true" />
        <h1 className="mt-pay-redirect__title">{title}</h1>
        <p className="mt-pay-redirect__message">{message}</p>
        {orderId ? (
          <p className="mt-pay-redirect__order">
            Order <strong>{orderId}</strong>
          </p>
        ) : null}
      </div>
    </div>
  )
}
