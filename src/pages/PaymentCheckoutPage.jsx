import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { getPaytmPgData } from '../api/orders'
import { invokePaytmCheckout } from '../lib/paytmCheckout'
import { orderAtom } from '../store/journey'
import './PaymentPage.css'

/**
 * /payment/checkout — loaded inside iframe on PaymentPage.
 * Loads Paytm CheckoutJS from `checkoutJsUrl` and invokes payment UI.
 */
export function PaymentCheckoutPage() {
  const storedOrder = useAtomValue(orderAtom)
  const pg = getPaytmPgData(storedOrder?.pgInitiate)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function startCheckout() {
      try {
        setStatus('loading')
        setError('')
        await invokePaytmCheckout(pg)
        if (!cancelled) setStatus('opened')
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err?.message || 'Could not open Paytm checkout')
      }
    }

    if (!pg.checkoutJsUrl || !pg.txnToken || !pg.orderId || pg.amount == null) {
      setStatus('error')
      setError('Paytm session data is missing. Go back and try again.')
      return undefined
    }

    startCheckout()
    return () => {
      cancelled = true
    }
  }, [pg.amount, pg.checkoutJsUrl, pg.orderId, pg.txnToken])

  return (
    <div className="mt-payment-checkout">
      {status === 'loading' ? <p className="mt-payment-checkout__msg">Opening Paytm…</p> : null}
      {status === 'opened' ? (
        <p className="mt-payment-checkout__msg">Complete payment in the Paytm window.</p>
      ) : null}
      {status === 'error' ? <p className="mt-payment-checkout__error">{error}</p> : null}
    </div>
  )
}
