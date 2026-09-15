import { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAtom } from 'jotai'
import { alertAtom } from '../store/alert'
import './Alert.css'

export function Alert({ msg, error = false, success = false, close, className = '' }) {
  const buttonRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusButton = () => {
      buttonRef.current?.focus()
    }
    const focusTimer = window.setTimeout(focusButton, 0)

    const handleFocusIn = () => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        window.setTimeout(focusButton, 0)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close])

  const toneClass = error ? ' is-error' : success ? ' is-success' : ''
  const message = msg || (success ? 'Operation completed successfully' : 'An error has occurred')

  return (
    <div className="mt-alert" onClick={close} role="presentation">
      <div
        ref={containerRef}
        className={`mt-alert__content${toneClass} ${className}`.trim()}
        role="alertdialog"
        aria-modal="true"
        aria-describedby="mt-alert-msg"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="mt-alert-msg">{message}</p>
        <button
          id="okayButton"
          ref={buttonRef}
          type="button"
          className="mt-alert__btn"
          onClick={close}
        >
          Ok
        </button>
      </div>
    </div>
  )
}

/** Root-level host — render once under Jotai. Trigger via `showAlertAtom`. */
export function AlertHost() {
  const [alert, setAlert] = useAtom(alertAtom)
  const close = useCallback(() => setAlert(null), [setAlert])
  if (!alert) return null

  return createPortal(
    <Alert
      msg={alert.msg}
      error={alert.error}
      success={alert.success}
      className={alert.className}
      close={close}
    />,
    document.body,
  )
}
