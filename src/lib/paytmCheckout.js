const PAYTM_MESSAGE_SOURCE = 'meeticket-paytm'

/**
 * Load Paytm CheckoutJS from the URL returned by pg/initiate (`checkoutJsUrl`).
 */
export function loadPaytmCheckoutScript(checkoutJsUrl) {
  if (!checkoutJsUrl) {
    return Promise.reject(new Error('Paytm checkoutJsUrl is missing'))
  }

  return new Promise((resolve, reject) => {
    if (window.Paytm?.CheckoutJS) {
      resolve()
      return
    }

    const existing = document.querySelector('script[data-meeticket-paytm="1"]')
    if (existing) {
      if (existing.getAttribute('src') === checkoutJsUrl) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('Failed to load Paytm checkout script')), {
          once: true,
        })
        return
      }
      existing.remove()
    }

    const script = document.createElement('script')
    script.type = 'application/javascript'
    script.src = checkoutJsUrl
    script.crossOrigin = 'anonymous'
    script.dataset.meeticketPaytm = '1'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paytm checkout script'))
    document.body.appendChild(script)
  })
}

function notifyParent(eventName, data) {
  if (window.parent === window) return
  window.parent.postMessage({ source: PAYTM_MESSAGE_SOURCE, eventName, data }, window.location.origin)
}

/**
 * Invoke Paytm CheckoutJS using pg/initiate `pgdata` fields.
 */
export async function invokePaytmCheckout({ orderId, txnToken, amount, checkoutJsUrl }) {
  if (!orderId || !txnToken || amount == null || !checkoutJsUrl) {
    throw new Error('Paytm checkout is missing orderId, txnToken, amount, or checkoutJsUrl')
  }

  await loadPaytmCheckoutScript(checkoutJsUrl)

  if (!window.Paytm?.CheckoutJS) {
    throw new Error('Paytm CheckoutJS is not available')
  }

  const config = {
    root: '',
    flow: 'DEFAULT',
    data: {
      orderId: String(orderId),
      token: String(txnToken),
      tokenType: 'TXN_TOKEN',
      amount: String(amount),
    },
    handler: {
      notifyMerchant(eventName, data) {
        notifyParent(eventName, data)
      },
    },
  }

  await new Promise((resolve, reject) => {
    window.Paytm.CheckoutJS.onLoad(() => {
      window.Paytm.CheckoutJS.init(config)
        .then(() => window.Paytm.CheckoutJS.invoke())
        .then(resolve)
        .catch(reject)
    })
  })
}

export function isPaytmParentMessage(event) {
  return (
    event?.origin === window.location.origin &&
    event?.data?.source === PAYTM_MESSAGE_SOURCE &&
    typeof event.data.eventName === 'string'
  )
}

export const PAYTM_SUCCESS_EVENTS = new Set(['PAYMENT_SUCCESS', 'TXN_SUCCESS', 'SUCCESS', 'CALLBACK_RECEIVED'])
export const PAYTM_FAILURE_EVENTS = new Set(['PAYMENT_FAILED', 'PAYMENT_FAILURE', 'TXN_FAILURE', 'FAILED'])
export const PAYTM_CLOSED_EVENTS = new Set(['APP_CLOSED', 'CLOSE'])
