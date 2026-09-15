import { atom } from 'jotai'

/**
 * App-wide alert dialog. `null` = closed.
 * Shape: { msg, error?, success?, className? }
 */
export const alertAtom = atom(null)

/** Write-only: pass a string, `{ msg, error, success }`, or `null` to close. */
export const showAlertAtom = atom(null, (_get, set, payload) => {
  if (payload == null) {
    set(alertAtom, null)
    return
  }
  if (typeof payload === 'string') {
    set(alertAtom, { msg: payload, error: false, success: false, className: '' })
    return
  }
  set(alertAtom, {
    msg: payload.msg || '',
    error: Boolean(payload.error),
    success: Boolean(payload.success),
    className: payload.className || '',
  })
})
