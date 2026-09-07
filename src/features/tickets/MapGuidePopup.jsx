import { useEffect, useId, useState } from 'react'
import { openGoogleMapsDirections } from '../../lib/mapGuide'
import './MapGuidePopup.css'

export function MapGuidePopup({ options = [], open, onClose }) {
  const listId = useId()
  const [selectedId, setSelectedId] = useState(options[0]?.id || null)
  const [backdropReady, setBackdropReady] = useState(false)

  useEffect(() => {
    if (!open) {
      setBackdropReady(false)
      return undefined
    }
    setSelectedId((current) => {
      if (current && options.some((option) => option.id === current)) return current
      return options[0]?.id || null
    })
    // Avoid the opening click falling through onto the backdrop and closing immediately.
    const timer = window.setTimeout(() => setBackdropReady(true), 0)
    return () => window.clearTimeout(timer)
  }, [open, options])

  useEffect(() => {
    if (!open) return undefined
    function onKey(event) {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const list = options.length
    ? options
    : [
        { id: 'first-mile', label: 'Boarding station', travelMode: 'driving' },
        { id: 'transit', label: 'Transit destination', travelMode: 'transit' },
        { id: 'last-mile', label: 'Destination', travelMode: 'driving' },
      ]

  const selected = list.find((option) => option.id === selectedId) || list[0]

  function handleView() {
    const ok = openGoogleMapsDirections(selected)
    if (!ok) {
      window.alert('Coordinates are not available for this stop yet.')
      return
    }
    onClose?.()
  }

  return (
    <>
      {backdropReady ? (
        <button
          type="button"
          className="mt-map-guide-backdrop"
          aria-label="Close map guide"
          onClick={onClose}
        />
      ) : null}
      <div
        className="mt-map-guide-popup"
        role="dialog"
        aria-label="Map Guide"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="mt-map-guide-popup__caret" aria-hidden="true" />
        <div className="mt-map-guide-popup__list" role="radiogroup" aria-labelledby={listId}>
          <span id={listId} className="mt-map-guide-popup__sr-only">
            Choose a place to view on map
          </span>
          {list.map((option) => {
            const active = option.id === selected?.id
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`mt-map-guide-popup__option${active ? ' is-selected' : ''}`}
                onClick={() => setSelectedId(option.id)}
              >
                <span className={`mt-map-guide-popup__radio${active ? ' is-on' : ''}`} aria-hidden="true" />
                <span className="mt-map-guide-popup__label">{option.label}</span>
              </button>
            )
          })}
        </div>
        <button type="button" className="mt-map-guide-popup__cta" onClick={handleView}>
          View On Map
        </button>
      </div>
    </>
  )
}
