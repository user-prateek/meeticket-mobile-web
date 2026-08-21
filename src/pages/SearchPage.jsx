import { useState } from 'react'
import { AppLogo, BackIcon, PhoneIcon } from '../components/icons'
import './SearchPage.css'

export function SearchPage({
  fromPlace,
  toPlace,
  mode: initialMode = 'multi',
  onSearch,
  onBack,
}) {
  const [mode, setMode] = useState(initialMode)
  const [from, setFrom] = useState(fromPlace)
  const [to, setTo] = useState(toPlace)

  function submit(event) {
    event.preventDefault()
    onSearch({ fromPlace: from.trim(), toPlace: to.trim(), mode })
  }

  return (
    <section className="mt-search">
      <header className="mt-search__header">
        <button type="button" className="mt-search__icon-btn" onClick={onBack} aria-label="Go back">
          <BackIcon />
        </button>
        <AppLogo />
        <button type="button" className="mt-search__icon-btn" aria-label="Contact">
          <PhoneIcon />
        </button>
      </header>

      <form className="mt-search__body" onSubmit={submit}>
        <div className="mt-search__modes" role="tablist" aria-label="Journey mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'multi'}
            className={mode === 'multi' ? 'is-active' : ''}
            onClick={() => setMode('multi')}
          >
            MULTI MODE
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'single'}
            className={mode === 'single' ? 'is-active' : ''}
            onClick={() => setMode('single')}
          >
            SINGLE MODE
          </button>
        </div>

        <div className="mt-search__card">
          <label className="mt-search__field">
            <span className="mt-search__pin is-from" />
            <input
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              placeholder="Enter From Place"
              aria-label="From place"
            />
          </label>
          <label className="mt-search__field">
            <span className="mt-search__pin is-to" />
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="Enter Destination Place"
              aria-label="Destination place"
            />
          </label>
          <button type="submit" className="mt-search__submit">
            Show Journey Options
          </button>
        </div>
      </form>
    </section>
  )
}
